"""Installer regression checks with isolated project fixtures."""

import contextlib
import importlib.util
import io
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

KIT_ROOT = Path(__file__).resolve().parent.parent
if str(KIT_ROOT) not in sys.path:
    sys.path.insert(0, str(KIT_ROOT))

from context import InstallContext
spec = importlib.util.spec_from_file_location(
    "factory_installer", KIT_ROOT / "setup" / "installer.py"
)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class ObsidianInstallTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.kit = self.root / "factory"
        self.ctx = InstallContext(root=self.root, kit=self.kit)
        for folder in ("profile", "agents", "skills", "loaders", "stack/rust/agents", "templates"):
            (self.kit / folder).mkdir(parents=True)
        self.capture_template = self.kit / "templates/OBSIDIAN_CAPTURE.md"
        self.capture_template.write_text("# {{title}}\nCaptured: {{date:YYYY-MM-DD}}\n")
        for name in installer.REQUIRED_CUSTOM:
            (self.kit / "profile" / name).write_text("Filled profile\n")
        testing = self.kit / "profile/testing.md"
        testing.write_text("\n".join(f"## {section}\nUse the fixture's stdlib checks.\n" for section in ("Test selection", "Launch", "Doctor", "Drive", "Evidence", "Cleanup")))
        for name in ("implementer", "research"):
            directory = self.kit / "agents" / name
            directory.mkdir()
            (directory / "agent.yaml").write_text(f"name: {name}\ntools: []\n")
            (directory / "instructions.md").write_text(f"Act as {name}.\n")
        self.stack_source = self.kit / "stack/rust/agents/rust-senior-developer.md"
        self.stack_source.write_text("---\nname: rust-senior-developer\n---\n\nRust instructions.\n")
        self.config = {"project": {"name": "fixture", "language": "rust"}, "paths": {}}
        self.vault = self.root / "notes/Project With Spaces"
        self.vault.mkdir(parents=True)
        (self.vault / "README.md").write_text("Vault router\n")
        self.agents = self.root / ".agents/agents"

    def install(self):
        (self.kit / "config.yaml").write_text(yaml.safe_dump(self.config))
        with contextlib.redirect_stdout(io.StringIO()):
            installer.run_install(self.ctx)

    def snapshot(self):
        return {
            str(path.relative_to(self.root)): str(path.readlink()) if path.is_symlink() else path.read_bytes()
            for path in self.root.rglob("*")
            if path.is_file() or path.is_symlink()
        }

    def test_enabled_vault_reaches_all_agents_and_rerun_is_idempotent(self):
        self.config["paths"]["obsidian_vault"] = "notes/Project With Spaces"
        self.agents.mkdir(parents=True)
        extra = self.agents / "custom.md"
        extra.write_text("Custom agent\n")
        self.install()
        for name in ("implementer", "research", "rust-senior-developer"):
            agent = self.agents / f"{name}.md"
            self.assertFalse(agent.is_symlink())
            self.assertIn("notes/Project With Spaces/README.md", agent.read_text())
            self.assertIn("factory/policy/obsidian.md", agent.read_text())
        self.assertIn("every agent (including subagents)", (self.root / "AGENTS.md").read_text())
        self.assertEqual(extra.read_text(), "Custom agent\n")
        self.assertNotIn("obsidian", self.stack_source.read_text())
        before = self.snapshot()
        self.install()
        self.assertEqual(before, self.snapshot())

    def test_disabled_vault_preserves_stack_symlinks(self):
        for paths in ({}, {"obsidian_vault": ""}, {"obsidian_vault": None}, {"obsidian_vault": "  "}):
            with self.subTest(paths=paths):
                self.config["paths"] = paths
                self.install()
                self.assertNotIn("## Obsidian", (self.root / "AGENTS.md").read_text())
                self.assertNotIn("policy/obsidian", (self.agents / "implementer.md").read_text())
                stack_agent = self.agents / self.stack_source.name
                self.assertTrue(stack_agent.is_symlink())
                self.assertEqual(stack_agent.read_text(), self.stack_source.read_text())
                self.assertFalse((self.vault / "Templates").exists())

    def test_capture_template_refresh_preserves_user_templates(self):
        self.config["paths"]["obsidian_vault"] = "notes/Project With Spaces"
        templates = self.vault / "Templates"
        templates.mkdir()
        user_template = templates / "Personal.md"
        user_template.write_text("User template\n")
        self.install()
        capture = templates / "Research capture.md"
        self.assertEqual(capture.read_bytes(), self.capture_template.read_bytes())
        capture.write_text("Local change in reserved generated template\n")
        self.capture_template.write_text("Updated canonical capture\n")
        self.install()
        self.assertEqual(capture.read_bytes(), self.capture_template.read_bytes())
        self.assertEqual(user_template.read_text(), "User template\n")

    def test_missing_capture_template_fails_before_mutation(self):
        self.config["paths"]["obsidian_vault"] = "notes/Project With Spaces"
        self.install()
        self.capture_template.unlink()
        before = self.snapshot()
        with self.assertRaisesRegex(SystemExit, "OBSIDIAN_CAPTURE.md must exist"):
            installer.run_install(self.ctx)
        self.assertEqual(before, self.snapshot())

    def test_disabled_vault_does_not_require_capture_template(self):
        self.capture_template.unlink()
        self.install()
        self.assertFalse((self.vault / "Templates").exists())

    def test_enabling_then_disabling_does_not_modify_stack_source(self):
        source = self.stack_source.read_bytes()
        self.config["paths"]["obsidian_vault"] = "notes/Project With Spaces"
        self.install()
        self.config["paths"]["obsidian_vault"] = ""
        self.install()
        self.assertTrue((self.agents / self.stack_source.name).is_symlink())
        self.assertEqual(source, self.stack_source.read_bytes())

    def test_invalid_vault_fails_before_generated_files_change(self):
        self.install()
        (self.vault / "README.md").unlink()
        for vault in ("missing", "notes/Project With Spaces", 123):
            with self.subTest(vault=vault):
                self.config["paths"]["obsidian_vault"] = vault
                (self.kit / "config.yaml").write_text(yaml.safe_dump(self.config))
                before = self.snapshot()
                with self.assertRaises(SystemExit):
                    installer.run_install(self.ctx)
                self.assertEqual(before, self.snapshot())

    def test_missing_testing_document_fails_before_generated_files_change(self):
        (self.kit / "config.yaml").write_text(yaml.safe_dump(self.config))
        testing = self.kit / "profile/testing.md"
        testing.unlink()
        before = self.snapshot()
        with self.assertRaisesRegex(SystemExit, "testing.md"):
            installer.run_install(self.ctx)
        self.assertEqual(before, self.snapshot())

    def test_default_profile_ignores_unfilled_example_documents(self):
        example = self.kit / "profile/example"
        example.mkdir()
        for name in installer.REQUIRED_CUSTOM:
            (example / name).write_text("<!-- UNFILLED -->\nExample Product\n")
        self.install()
        rules = (self.root / "AGENTS.md").read_text()
        self.assertIn("`factory/profile/layering.md`", rules)
        self.assertNotIn("profile/example", rules)
        self.assertFalse((self.root / ".agents/skills/fixture-testing").exists())

    def test_configured_profile_still_overrides_default(self):
        configured = self.root / "profiles/Alternate Profile"
        configured.parent.mkdir()
        (self.kit / "profile").rename(configured)
        self.config["paths"]["profile"] = "profiles/Alternate Profile"
        self.install()
        self.assertIn(
            "`profiles/Alternate Profile/layering.md`",
            (self.root / "AGENTS.md").read_text(),
        )
        self.assertEqual(installer.custom_profile_problems(self.config, self.root), [])
        self.assertFalse((self.root / ".agents/skills/fixture-testing").exists())

    def test_installer_reads_active_config_without_local_merge(self):
        (self.kit / "config.local.yaml").write_text("project:\n  name: local-only\n")
        self.install()
        self.assertTrue((self.root / "AGENTS.md").read_text().startswith("# fixture\n"))

    def test_knowledge_base_path_merges_from_local_and_reaches_agents(self):
        self.agents.mkdir(parents=True)
        kb = self.root / "external-kb"
        kb.mkdir()
        (kb / "INDEX.md").write_text("Title: index\n")
        self.config["paths"]["knowledge_base"] = ""
        (self.kit / "config.local.yaml").write_text(
            yaml.safe_dump({"paths": {"knowledge_base": str(kb)}})
        )
        self.config["paths"]["obsidian_vault"] = "notes/Project With Spaces"
        self.install()
        agents_md = (self.root / "AGENTS.md").read_text()
        self.assertIn("INDEX.md", agents_md)
        self.assertIn("Projects/fixture/", agents_md)
        implementer = (self.agents / "implementer.md").read_text()
        self.assertIn(str(kb), implementer)

    def test_missing_knowledge_base_fails_before_mutation(self):
        self.config["paths"]["obsidian_vault"] = "notes/Project With Spaces"
        self.install()
        self.config["paths"]["knowledge_base"] = "no-such-kb"
        (self.kit / "config.yaml").write_text(yaml.safe_dump(self.config))
        local = self.kit / "config.local.yaml"
        if local.is_file():
            local.unlink()
        before = self.snapshot()
        with self.assertRaisesRegex(SystemExit, "INDEX.md"):
            installer.run_install(self.ctx)
        self.assertEqual(before, self.snapshot())


class AgentContractTests(unittest.TestCase):
    setUp = ObsidianInstallTests.setUp
    install = ObsidianInstallTests.install
    snapshot = ObsidianInstallTests.snapshot

    def make_skill(self, name, stack=None):
        directory = self.kit / (f"stack/{stack}/skills" if stack else "skills") / name
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "SKILL.md").write_text(
            f"---\nname: {name}\ndescription: Fixture skill\n---\n")

    def metadata(self, name):
        return yaml.safe_load((self.agents / f"{name}.md").read_text().split("---", 2)[1])

    def test_skill_metadata_flags_and_rerender(self):
        for name in ("core", "ponytail", "caveman"):
            self.make_skill(name)
        source = self.kit / "agents/implementer/agent.yaml"
        source.write_text(yaml.safe_dump({
            "name": "implementer", "tools": ["Read"], "model": "fixture-model",
            "effort": "high", "color": "blue",
            "skills": [{"source": "../../skills/core"}, "ponytail", "caveman"],
        }))
        self.stack_source.write_text("---\n" + yaml.safe_dump({
            "name": "rust-senior-developer", "model": "stack-model", "effort": "low",
            "color": "green", "skills": ["core", "ponytail", "caveman"],
        }) + "---\nStack body.\n")
        for enabled in (False, True, False):
            self.config["tools"] = {"ponytail": enabled, "caveman": enabled}
            self.install()
            for name, model, effort, color in (
                ("implementer", "fixture-model", "high", "blue"),
                ("rust-senior-developer", "stack-model", "low", "green"),
            ):
                metadata = self.metadata(name)
                self.assertEqual(metadata["skills"], ["core", "ponytail", "caveman"] if enabled else ["core"])
                self.assertEqual((metadata["model"], metadata["effort"], metadata["color"]), (model, effort, color))
                body = (self.agents / f"{name}.md").read_text()
                self.assertEqual(installer.CAVEMAN_LINE in body, enabled)
                self.assertEqual(installer.PONYTAIL_LINE in body, enabled)
            before = self.snapshot()
            self.install()
            self.assertEqual(before, self.snapshot())

    def test_invalid_contracts_stop_before_generated_mutation(self):
        self.make_skill("core")
        self.install()
        source = self.kit / "agents/implementer/agent.yaml"
        for metadata, error in (
            ({"name": "implementer", "skills": ["missing"]}, "missing skill entrypoint"),
            ({"name": "implementer", "skills": ["core", {"source": "../../skills/core"}]}, "duplicate skill"),
            ({"name": "research"}, "duplicate agent name"),
            ({"name": "implementer", "skills": [{"source": "../../../outside"}]}, "inside the kit"),
        ):
            with self.subTest(error=error):
                source.write_text(yaml.safe_dump(metadata))
                before = self.snapshot()
                with self.assertRaisesRegex(SystemExit, error):
                    installer.run_install(self.ctx)
                self.assertEqual(before, self.snapshot())

    def test_skill_resolution_uses_only_selected_stack(self):
        self.make_skill("language-core", stack="typescript")
        source = self.kit / "agents/implementer/agent.yaml"
        source.write_text("name: implementer\nskills: [language-core]\n")
        problems = installer.agent_contract_problems(self.config, self.kit)
        self.assertTrue(any("missing skill entrypoint" in problem for problem in problems))
        self.make_skill("language-core", stack="rust")
        self.assertEqual(installer.agent_contract_problems(self.config, self.kit), [])
        self.install()
        self.assertEqual(self.metadata("implementer")["skills"], ["language-core"])

    def test_dangling_and_malformed_skill_metadata_are_rejected(self):
        self.make_skill("core")
        source = self.kit / "agents/implementer/agent.yaml"
        source.write_text("name: implementer\nskills: [core]\n")
        skill = self.kit / "skills/core/SKILL.md"
        skill.unlink()
        skill.symlink_to("absent.md")
        self.assertTrue(installer.agent_contract_problems(self.config, self.kit))
        skill.unlink()
        skill.write_text("---\nname: wrong-name\ndescription: fixture\n---\n")
        self.assertTrue(installer.agent_contract_problems(self.config, self.kit))


if __name__ == "__main__":
    unittest.main()
