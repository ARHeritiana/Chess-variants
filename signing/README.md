# Android release signing

The private signing key belongs in **GitHub Actions repository secrets**, not in Git, a release,
an issue, or a workflow artifact. GitHub encrypts secret values; the upload helper uses `gh` to
encrypt them locally before sending them. This directory contains only the public certificate.

The release key uses alias `cos`, RSA-3072 / SHA256withRSA, a password-protected PKCS12 keystore,
and a 10,000-day certificate. The keystore and key have the same randomly generated password.
The certificate identifies builds; it does not contain the private signing key.

Certificate SHA-256: `e2825f29d3d9d5e5bd55e3f029878ead857fffc6c7818d8c3b6e0fc2bfec8ea5`.

## Configure GitHub

Two repository Actions secrets are required:

- `ANDROID_KEYSTORE_BASE64`: base64 of the private keystore.
- `ANDROID_KEYSTORE_PASSWORD`: its password (also the private-key password).

Use a `gh` connection with **Secrets read/write** access to this repository (for a fine-grained
personal access token). A classic token needs the appropriate repository access. Authenticate
through `gh auth login`; do not paste a token or a signing password into chat.

Upload without printing secret values:

```sh
python3 tools/signing/upload-secrets.py --directory /path/to/private/signing-directory
```

The helper preflights access and refuses to replace existing signing secrets. If an upload
partially fails, check the secret names in GitHub before retrying; do not generate another key.
Alternatively, set the two secrets through **Settings → Secrets and variables → Actions**.
Secret values are write-only: GitHub does not offer a way to download a stored signing key later.

## Build a signed APK in Actions

After the workflow is merged into the default branch and the secrets are configured, go to
**Actions → Build signed Android APK → Run workflow**, select the default branch, and enter
an increasing version code plus a display version. The workflow:

1. Restores the key and password into private temporary files.
2. Verifies the signing identity against `release-certificate.pem` before using it.
3. Builds and verifies the APK with Java 17 and Android SDK tools.
4. Uploads only `ChessVariants-<versionCode>.apk` as a 14-day artifact.
5. Removes the temporary signing files, including after a failed build.

It runs manually on the default branch only, never automatically for a pull request. Its
repository token has read-only contents access, and third-party actions are pinned to commits.
This workflow builds an artifact; it does not publish a release. Attach the verified APK to a
stable release when ready to make it available through the app's update checker.

For a local build:

```sh
KS_FILE=/path/to/private/signing-directory/release.keystore \
KS_PASS_FILE=/path/to/private/signing-directory/keystore-password.txt ./build.sh
```

## Backup and continuity

Keep an independent encrypted backup of **both** `release.keystore` and
`keystore-password.txt` in a password manager or other secure storage you control. The private
working directory uses permission 0700 and both private files use 0600. Do not rely on an
execution workspace or on GitHub secrets as the only recoverable copy.

Reuse this exact key for every future APK update. A new key cannot update an existing APK
signed with another key. If previous installations used a different key and that key cannot
be recovered, switching to this signing identity requires uninstalling/reinstalling the app,
which can remove locally saved games/settings. Back up game PGNs before doing that.

To create an initial key for another app or an explicitly chosen new signing identity:

```sh
python3 tools/signing/create-key.py --directory /new/private/directory/outside/the/repository
```

The creation helper refuses to overwrite a directory or put private files inside this repository.
Do not run it to repair a missing GitHub secret; re-upload the existing backed-up key instead.
