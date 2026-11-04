# Binary provenance, code signing, and deployment policies — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 14, “Deploying Code,” by Jeremiah Spradlin and Mark Lodato with Sergey
Simakov and Roxana Loza. Only page furniture (page numbers, running heads,
line-break hyphens) was removed and the one JSON block was fenced; the wording
is unchanged.

---

## Advanced Mitigation Strategies

You may need complex mitigations to address some of the more advanced threats to your software supply chain. Because the recommendations in this section are not yet standard across the industry, you may need to build some custom infrastructure to adopt them. These recommendations are best suited for large and/or particularly security-sensitive organizations, and may not make sense for small organizations with low exposure to insider risk.

## Binary Provenance

Every build should produce binary provenance describing exactly how a given binary artifact was built: the inputs, the transformation, and the entity that performed the build.

To explain why, consider the following motivating example. Suppose you are investigating a security incident and see that a deployment occurred within a particular time window. You’d like to determine if the deployment was related to the incident. Reverse engineering the binary would be prohibitively expensive. It would be much easier to inspect the source code, preferably by looking at changes in version control. But how do you know what source code the binary came from?

Even if you don’t anticipate that you’ll need these types of security investigations, you’ll also need binary provenance for provenance-based deployment policies, as discussed later in this section.

## What to put in binary provenance

The exact information you should include in the provenance depends on the assumptions built into your system and the information that consumers of the provenance will eventually need. To enable rich deployment policies and allow for ad hoc analysis, we recommend the following provenance fields:

## Authenticity (required)

Connotes implicit information about the build, such as which system produced it and why you can trust the provenance. This is usually accomplished using a cryptographic signature protecting the rest of the fields of the binary provenance.11

## Outputs (required)

The output artifacts to which this binary provenance applies. Usually, each output is identified by a cryptographic hash of the content of the artifact.

## Inputs

What went into the build. This field allows the verifier to link properties of the source code to properties of the artifact. It should include the following:

## Sources

The “main” input artifacts to the build, such as the source code tree where the top-level build command ran. For example: “Git commit 270f...ce6d from https://github.com/mysql/mysql-server”12 or “file foo.tar.gz with SHA-256 content 78c5...6649.”

## Dependencies

All other artifacts you need for the build—such as libraries, build tools, and compilers—that are not fully specified in the sources. Each of these inputs can affect the integrity of the build.

## Command

The command used to initiate the build. For example: “bazel
build //main:hello-world”. Ideally, this field is structured to allow for automa‐
ted analysis, so our example might become “{"bazel": {"command": "build",
"target": "//main:hello_world"}}”.

## Environment

Any other information you need to reproduce the build, such as architecture details or environment variables.

## Input metadata

In some cases, the builder may read metadata about the inputs that downstream systems will find useful. For example, a builder might include the timestamp of the source commit, which a policy evaluation system then uses at deployment time.

- 11 Note that authenticity implies integrity.

- 12 Git commit IDs are cryptographic hashes that provide integrity of the entire source tree.

## Debug info

Any extra information that isn’t necessary for security but may be useful for debugging, such as the machine on which the build ran.

## Versioning

A build timestamp and provenance format version number are often useful to allow for future changes—for example, so you can invalidate old builds or change the format without being susceptible to rollback attacks.

You can omit fields that are implicit or covered by the source itself. For example, Debian’s provenance format omits the build command because that command is always dpkg-buildpackage.

Input artifacts should generally list both an identifier, such as a URI, and a version, such as a cryptographic hash. You typically use the identifier to verify the authenticity of the build—for example, to verify that code came from the proper source repository. The version is useful for various purposes, such as ad hoc analysis, ensuring reproducible builds, and verification of chained build steps where the output of step i is the input to step i+1.

Be aware of the attack surface. You need to verify anything not checked by the build system (and therefore implied by the signature) or included in the sources (and therefore peer reviewed) downstream. If the user who initiated the build can specify arbitrary compiler flags, the verifier must validate those flags. For example, GCC’s -D flag allows the user to overwrite arbitrary symbols, and therefore also to completely change the behavior of a binary. Similarly, if the user can specify a custom compiler, then the verifier must ensure that the “right” compiler was used. In general, the more validation the build process can perform, the better.

For a good example of binary provenance, see Debian’s deb-buildinfo format. For more general advice, see the Reproducible Builds project’s documentation. For a standard way to sign and encode this information, consider JSON Web Tokens (JWT).

## Code Signing

Code signing is often used as a security mechanism to increase trust in binaries. Use care when applying this technique, however, because a signature’s value lies entirely in what it represents and how well the signing key is protected.

Consider the case of trusting a Windows binary, as long as it has any valid Authenticode signature. To bypass this control, an attacker can either buy or steal a valid signing certificate, which perhaps costs a few hundred to a few thousand dollars (depending on the type of certificate). While this approach does have security value, it has limited benefit.

To increase the effectiveness of code signing, we recommend that you explicitly list the signers you accept and lock down access to the associated signing keys. You should also ensure that the environment where code signing occurs is hardened, so an attacker can’t abuse the signing process to sign their own malicious binaries. Consider the process of obtaining a valid code signature to be a “deployment” and follow the recommendations laid out in this chapter to protect those deployments.

## Provenance-Based Deployment Policies

“Verify Artifacts, Not Just People” on page 309 recommends that the official build automation pipeline should verify what is being deployed. How do you verify that the pipeline is configured properly? And what if you want to make specific guarantees for some deployment environments that don’t apply to other environments?

You can use explicit deployment policies that describe the intended properties of each deployment environment to address these concerns. The deployment environments can then match these policies against the binary provenance of artifacts deployed to them.

This approach has several benefits over a pure signature-based approach:

• It reduces the number of implicit assumptions throughout the software supply chain, making it easier to analyze and ensure correctness.

• It clarifies the contract of each step in the software supply chain, reducing the likelihood of misconfiguration.

• It allows you to use a single signing key per build step rather than per deployment environment, since you can now use the binary provenance for deployment decisions.

For example, suppose you have a microservices architecture and want to guarantee that each microservice can be built only from code submitted to that microservice’s source repository. Using code signing, you would need one key per source repository, and the CI/CD system would have to choose the correct signing key based on the source repository. The disadvantage to this approach is that it’s challenging to verify that the CI/CD system’s configuration meets these requirements.

Using provenance-based deployment policies, the CI/CD system produces binary provenance stating the originating source repository, always signed with a single key. The deployment policy for each microservice lists which source repository is allowed. Verification of correctness is much easier than with code signing, because the deployment policy describes each microservice’s properties in a single place.

The rules listed in your deployment policy should mitigate the threats to your system. Refer to the threat model you created for your system. What rules can you define to

mitigate those threats? For reference, here are some example rules you may want to implement:

• Source code was submitted to version control and peer reviewed.

• Source code came from a particular location, such as a specific build target and repository.

• Build was through the official CI/CD pipeline (see “Verifiable Builds” on page 319).

- Tests have passed.

- Binary was explicitly allowed for this deployment environment. For example, do not allow "test" binaries in production.

• Version of code or build is sufficiently recent."

• Code is free of known vulnerabilities, as reported by a sufficiently recent security scan.14

The in-toto framework provides one standard for implementing provenance policies.

## Implementing policy decisions

If you implement your own engine for provenance-based deployment policies, remember that three steps are necessary:

1. Verify that the provenance is authentic. This step also implicitly verifies the integrity of the provenance, preventing an adversary from tampering with or forging it. Typically, this means verifying that the provenance was cryptographically signed by a specific key.

2. Verify that the provenance applies to the artifact. This step also implicitly verifies the integrity of the artifact, ensuring an adversary cannot apply an otherwise “good” provenance to a “bad” artifact. Typically, this means comparing a cryptographic hash of the artifact to the value found within the provenance’s payload.

3. Verify that the provenance meets all the policy rules.

The simplest example of this process is a rule that requires artifacts to be signed by a specific key. This single check implements all three steps: it verifies that the signature itself is valid, that the artifact applies to the signature, and that the signature is present.

13 For a discussion on rollbacks to vulnerable versions, see “Minimum Acceptable Security Version Numbers” on page 195.

14 For example, you might require proof that Cloud Security Scanner found no results against your test instance running this specific version of the code.

Let’s consider a more complex example: “Docker image must be built from GitHub repo mysql/mysql-server.” Suppose your build system uses key KB to sign build provenance in a JWT format. In this case, the schema of the token’s payload would be the following, where the subject, sub, is an RFC 6920 URI:

```json
{
"sub": "ni:///sha-256;...",
"input": [{"source_uri": "...")
}
```

To evaluate whether an artifact satisfies this rule, the engine needs to verify the following:

1. The JWT signature verifies using key KB.

2. sub matches the SHA-256 hash of the artifact.

3. input.source_uri is exactly "https://github.com/mysql/mysql-server".
