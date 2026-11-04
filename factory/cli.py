#!/usr/bin/env python3
"""Factory kit CLI: setup, check, install, bundle-session. Run: python3 factory/cli.py --help"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `python3 factory/cli.py` when the host repo root is cwd.
_KIT_ROOT = Path(__file__).resolve().parent
if str(_KIT_ROOT) not in sys.path:
    sys.path.insert(0, str(_KIT_ROOT))

from setup.commands import main

if __name__ == "__main__":
    main()
