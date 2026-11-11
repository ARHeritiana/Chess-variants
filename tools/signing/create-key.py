#!/usr/bin/env python3
"""Create an Android release key outside the repository. Never print its password."""
import argparse
import hashlib
import os
from pathlib import Path
import secrets
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory', required=True, type=Path, help='New private directory outside the repository')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[2]
folder = args.directory.resolve()
if folder == repo or repo in folder.parents:
    parser.error('Keep signing material outside the repository.')
folder.mkdir(mode=0o700, parents=True, exist_ok=False)
folder.chmod(0o700)
password = folder / 'keystore-password.txt'
with os.fdopen(os.open(password, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), 'w') as file:
    file.write(secrets.token_urlsafe(32) + '\n')
keystore = folder / 'release.keystore'
subprocess.run([
    'keytool', '-genkeypair', '-noprompt', '-storetype', 'PKCS12',
    '-keystore', str(keystore), '-storepass:file', str(password), '-keypass:file', str(password),
    '-alias', 'cos', '-keyalg', 'RSA', '-keysize', '3072', '-sigalg', 'SHA256withRSA',
    '-validity', '10000', '-dname', 'CN=Chess Variants Release',
], check=True)
keystore.chmod(0o600)
for name, extra in [('release-certificate.der', []), ('release-certificate.pem', ['-rfc'])]:
    subprocess.run([
        'keytool', '-exportcert', '-keystore', str(keystore), '-storepass:file', str(password),
        '-alias', 'cos', '-file', str(folder / name), *extra,
    ], check=True)
    (folder / name).chmod(0o600)
fingerprint = hashlib.sha256((folder / 'release-certificate.der').read_bytes()).hexdigest()
print(f'Private keystore and password created in {folder} (directory 0700; files 0600).')
print(f'Public certificate SHA-256: {fingerprint}')
print('Keep an independent secure backup of both private files; GitHub secrets cannot be downloaded later.')
