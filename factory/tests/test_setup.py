"""Guided setup CLI tests use isolated project roots."""

import os
import sys
import tempfile
import unittest
from pathlib import Path

import yaml
from click.testing import CliRunner

KIT_ROOT = Path(__file__).resolve().parent.parent
if str(KIT_ROOT) not in sys.path:
    sys.path.insert(0, str(KIT_ROOT))

from setup import installer
from setup.commands import cli
from setup.context import default_project_root
from setup.readiness import REQUIRED_PROFILE


class SetupCliTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "Project With Spaces"
        self.root.mkdir()
        self.runner = CliRunner()

    def create_profile(self, testing=True):
        factory = self.root / "factory"
        profile = factory / "profile"
        profile.mkdir(parents=True)
        (factory / "config.yaml").write_text(
            yaml.safe_dump(
                {
                    "project": {"name": "fixture", "language": "python"},
                    "paths": {"profile": "factory/profile"},
                    "commands": {"test_scope": "pytest"},
                    "tools": {},
                }
            )
        )
        for name in REQUIRED_PROFILE:
            (profile / name).write_text(f"Filled {name}\n")
        if testing:
            testing_file = profile / "testing.md"
            testing_file.write_text(
                "\n".join(
                    f"## {section}\nUse the fixture's stdlib checks.\n"
                    for section in (
                        "Test selection",
                        "Launch",
                        "Doctor",
                        "Drive",
                        "Evidence",
                        "Cleanup",
                    )
                )
            )
        return profile

    def invoke(self, *args):
        return self.runner.invoke(cli, list(args))

    def test_help_is_noninteractive(self):
        result = self.invoke("--help")
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("setup", result.output)
        self.assertIn("check", result.output)

    def test_setup_works_without_config_and_writes_copyable_prompt(self):
        output = self.root / "handoff prompt.md"
        result = self.invoke("setup", "--root", str(self.root), "--output", str(output))
        self.assertEqual(result.exit_code, 0, result.output)
        prompt = output.read_text()
        self.assertIn(str(self.root), prompt)
        self.assertIn(str(self.root / "factory"), prompt)
        self.assertIn("Execute one available journey", prompt)
        self.assertIn("Missing", result.output)

    def test_setup_refuses_to_overwrite_prompt(self):
        output = self.root / "prompt.md"
        output.write_text("keep me")
        result = self.invoke("setup", "--root", str(self.root), "--output", str(output))
        self.assertNotEqual(result.exit_code, 0)
        self.assertEqual(output.read_text(), "keep me")

    def test_check_reports_missing_testing_sections(self):
        self.create_profile(testing=False)
        result = self.invoke("check", "--root", str(self.root))
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("missing the 'Test selection' section", result.output)

    def test_check_accepts_filled_fixture_and_separates_runtime_verification(self):
        self.create_profile()
        result = self.invoke("check", "--root", str(self.root))
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("configured; runtime behavior remains unverified", result.output)

    def test_check_from_factory_cwd_without_explicit_root(self):
        self.create_profile()
        factory = self.root / "factory"
        previous_cwd = Path.cwd()
        os.chdir(factory)
        self.addCleanup(os.chdir, previous_cwd)
        result = self.invoke("check")
        self.assertEqual(result.exit_code, 0, result.output)

    def test_default_project_root_uses_config_next_to_cli_script(self):
        self.create_profile()
        factory = self.root / "factory"
        self.assertEqual(
            default_project_root(script=factory / "cli.py"), self.root.resolve()
        )

    def test_default_project_root_falls_back_to_factory_under_cwd(self):
        self.create_profile()
        bare_kit = self.root / "bare-kit"
        bare_kit.mkdir()
        previous_cwd = Path.cwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, previous_cwd)
        self.assertEqual(
            default_project_root(script=bare_kit / "cli.py"), self.root.resolve()
        )

    def test_missing_testing_section_is_actionable_not_a_crash(self):
        profile = self.create_profile()
        (profile / "testing.md").write_text("## Test selection\nExisting suite.\n")
        result = self.invoke("check", "--root", str(self.root))
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("missing the 'Launch' section", result.output)

    def test_install_stops_before_install_when_not_ready(self):
        self.create_profile(testing=False)
        result = self.invoke("install", "--root", str(self.root))
        self.assertNotEqual(result.exit_code, 0)
        self.assertNotIn("installed factory kit", result.output)

    def test_check_rejects_missing_core_config(self):
        self.create_profile()
        (self.root / "factory/config.yaml").write_text("paths: {}\n")
        result = self.invoke("check", "--root", str(self.root))
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("project.name", result.output)
        self.assertIn("project.language", result.output)
        self.assertIn("commands must be a mapping", result.output)

    def test_empty_testing_sections_do_not_pass_check_or_direct_install_gate(self):
        profile = self.create_profile()
        testing = profile / "testing.md"
        testing.write_text(testing.read_text().replace("Use the fixture's stdlib checks.", ""))
        result = self.invoke("check", "--root", str(self.root))
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("project-specific content", result.output)
        config = yaml.safe_load((self.root / "factory/config.yaml").read_text())
        self.assertTrue(installer.custom_profile_problems(config, self.root))

    def test_installer_removes_only_legacy_testing_links(self):
        profile = self.create_profile()
        original_root = installer.ROOT
        installer.ROOT = self.root
        self.addCleanup(setattr, installer, "ROOT", original_root)
        config = yaml.safe_load((self.root / "factory/config.yaml").read_text())
        links = []
        for host in installer.HOST_SKILL_DIRS:
            directory = self.root / host
            directory.mkdir(parents=True)
            legacy = directory / "old-project-testing"
            legacy.symlink_to(profile / "skills/testing")
            unrelated = directory / "unit-testing"
            unrelated.symlink_to(self.root / "factory/skills/unit-testing")
            links.append((legacy, unrelated))
        links[1][0].unlink()
        links[1][0].symlink_to(links[0][0])
        installer.remove_legacy_testing_skill_links(config)
        for legacy, unrelated in links:
            self.assertFalse(legacy.is_symlink())
            self.assertTrue(unrelated.is_symlink())
        self.assertEqual(installer.custom_profile_problems(config, self.root), [])


if __name__ == "__main__":
    unittest.main()
