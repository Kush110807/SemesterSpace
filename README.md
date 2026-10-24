# RC14-D-01 bounded patch download

Download `RC14-D-01.zip` using its Raw / Download button, then extract it. The ZIP contains `RC14-D-01.patch`, the repair handoff, results and this README. This is the same six-file repair as commit 95de7e5e65c5e833529c2fe6db0a929c6c6c9f97. No runtime changes were made to create this download.

A should apply the patch from the root of its RC-001.4 source tree (the directory containing semester-space):

```sh
git apply --check RC14-D-01.patch
git apply RC14-D-01.patch
```

The patch was verified against SEMESTERSPACE_RC0014_A_D02_SOURCE.zip, SHA-256 b0a5086f12ded21e89cec85a31e3e758577837f01c646f9195f58deed4595633. Review any newer changes before application. A owns integration and native-browser verification. No merge or deployment.

The external RC14-D-01.zip.sha256 covers the named ZIP. This delivery fixes a download problem only; it does not replace the integrated application or change the repair.
