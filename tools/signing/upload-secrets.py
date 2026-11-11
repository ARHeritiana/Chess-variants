#!/usr/bin/env python3
"""Upload Android signing secrets using gh's local encryption, without printing their values."""
import argparse
import base64
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory', required=True, type=Path, help='Private directory created by create-key.py')
parser.add_argument('--repo', default='ARHeritiana/Chess-variants')
args = parser.parse_args()
folder = args.directory.resolve()
files = [folder / 'release.keystore', folder / 'keystore-password.txt']
if not all(file.is_file() for file in files):
    parser.error('Private keystore or password file is missing.')
# Preflight access before reading either secret, and never silently replace an existing signing identity.
listed = subprocess.run([
    'gh', 'api', '--paginate', f'repos/{args.repo}/actions/secrets', '--jq', '.secrets[].name',
], capture_output=True, text=True)
if listed.returncode:
    reason = 'HTTP 403: the connected GitHub account/app lacks Actions secrets access.' if '403' in listed.stderr else 'GitHub Actions secrets access failed.'
    sys.exit(reason + ' No signing secrets were uploaded. Use an authenticated gh connection with Secrets read/write access.')
names = {'ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD'}
if names.intersection(listed.stdout.splitlines()):
    sys.exit('Signing secrets already exist. Refusing to replace a potentially different release key.')
key = base64.b64encode(files[0].read_bytes()).decode('ascii')
password = files[1].read_text().rstrip('\r\n')
if not password or '\n' in password or '\r' in password:
    sys.exit('Password file must contain exactly one nonempty line.')
# gh encrypts each value locally with the repository public key before uploading.
values = f'ANDROID_KEYSTORE_BASE64={key}\nANDROID_KEYSTORE_PASSWORD={password}\n'
uploaded = subprocess.run([
    'gh', 'secret', 'set', '--repo', args.repo, '--env-file', '-',
], input=values, text=True, capture_output=True)
if uploaded.returncode:
    sys.exit('Secret upload failed. Check access and secret names before retrying; a partial upload is possible. No values were printed.')
print('Stored ANDROID_KEYSTORE_BASE64 and ANDROID_KEYSTORE_PASSWORD as GitHub Actions secrets.')
