# Verifiable builds — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 14, “Deploying Code,” by Jeremiah Spradlin and Mark Lodato with Sergey
Simakov and Roxana Loza. Only page furniture (page numbers, running heads,
line-break hyphens) was removed and the one JSON block was fenced; the wording
is unchanged.

---

## Verifiable Builds

We call a build verifiable if the binary provenance produced by the build is trustworthy.15 Verifiability is in the eye of the beholder. Whether or not you trust a particular build system depends on your threat model and how the build system fits into your organization’s larger security story.

Consider whether the following examples of nonfunctional requirements are appropriate for your organization,16 and add any requirements that meet your specific needs:

	• If a single developer’s workstation is compromised, the integrity of binary provenance or output artifacts is not compromised.

	• An adversary cannot tamper with provenance or output artifacts without detection.

	• One build cannot affect the integrity of another build, whether run in parallel or serial.

	• A build cannot produce provenance containing false information. For example, the provenance should not be able to claim an artifact was built from Git commit abc...def when it really came from 123...456.

- 15 Recall that pure signatures still count as “binary provenance,” as described in the previous section.

- 16 See “Design Objectives and Requirements” on page 44.

• Nonadministrators cannot configure user-defined build steps, such as a Makefile or a Jenkins Groovy script, in a way that violates any requirement in this list.

• A snapshot of all source artifacts is available for at least N months after the build, to allow for potential investigations.

• A build is reproducible (see “Hermetic, Reproducible, or Verifiable?” on page 321). This approach may be desirable even if it is not required by the verifiable build architecture, as defined in the next section. For example, reproducible builds may be useful to independently reverify the binary provenance of an artifact after discovering a security incident or vulnerability.

## Verifiable build architectures

The purpose of a verifiable build system is to increase a verifier’s trust in the binary provenance produced by that build system. Regardless of the specific requirements for verifiability, three main architectures are available:

## Trusted build service

The verifier requires that the original build has been performed by a build service that the verifier trusts. Usually, this means that the trusted build service signs the binary provenance with a key accessible only to that service.

This approach has the advantages of needing to build only once and not requiring reproducibility (see “Hermetic, Reproducible, or Verifiable?” on page 321). Google uses this model for internal builds.

## A rebuild you perform yourself

The verifier reproduces the build on the fly in order to validate the binary provenance. For example, if the binary provenance claims to come from Git commit abc...def, the verifier fetches that Git commit, reruns the build commands listed in the binary provenance, and checks that the output is bit-for-bit identical to the artifact in question. See the following sidebar for more about reproducibility. While this approach may initially seem appealing because you trust yourself, it is not scalable. Builds often take minutes or hours, whereas deployment decisions often need to be made in milliseconds. This also requires the build to be fully reproducible, which is not always practical; see the sidebar for more information.

## Rebuilding service

The verifier requires that some quorum of “rebuilders” have reproduced the build and attested to the authenticity of the binary provenance. This is a hybrid of the two previous options. In practice, this approach usually means that each rebuilder monitors a package repository, proactively rebuilds each new version, and stores the results in some database. Then, the verifier looks up entries in N different databases, keyed by the cryptographic hash of the artifact in question.

Open source projects like Debian use this model when a central authority model is infeasible or undesirable.

# Hermetic, Reproducible, or Verifiable?

The concepts of reproducible builds and hermetic builds are closely related to verifiable builds. Terminology in this area is not yet standard,17 so we propose the following definitions:

## Hermetic

All inputs to the build are fully specified up front, outside the build process. In addition to the source code, this requirement applies to all compilers, build tools, libraries, and any other inputs that might influence the build. All references must be unambiguous, either as fully resolved version numbers or cryptographic hashes. Hermeticity information is checked in as part of the source code, but it is also acceptable for this information to live externally, such as in a Debian .buildinfo file.

Hermetic builds have the following benefits:

• They enable build input analysis and policy application. Examples from Google include detecting vulnerable software that needs patching by using the Common Vulnerabilities and Exposures (CVE) database, ensuring compliance with open source licenses, and preventing software use that is disallowed by policy, such as a known insecure library.

• They guarantee integrity of third-party imports—for example, by verifying cryptographic hashes of dependencies or by requiring that all fetches use HTTPS and come from trustworthy repositories.

• They enable cherry-picking. You can fix a bug by patching the code, rebuilding the binary, and rolling it out to production without including any extraneous changes in behavior, such as behavior changes caused by a different compiler version. Cherry-picking significantly reduces the risk associated with emergency releases, which may not undergo as much testing and vetting as regular releases.

Examples of hermetic builds include Bazel when run in sandboxed mode and npm when using package-lock.json.

17 For example, the SRE book uses the terms hermetic and reproducible interchangeably. The Reproducible Builds project defines reproducible the same way this chapter defines the term, but occasionally overloads reproducible to mean verifiable.

## Reproducible

Running the same build commands on the same inputs is guaranteed to produce bit-by-bit identical outputs. Reproducibility almost always requires hermeticity.18

Reproducible builds have the following benefits:

• Verifiability—A verifier can determine the binary provenance of an artifact by reproducing the build themselves or by using a quorum of rebuilders, as described in “Verifiable Builds” on page 319.

• Hermeticity—Nonreproducibility often indicates nonhermeticity. Continuously testing for reproducibility can help detect nonhermeticity early, thereby ensuring all the benefits of hermeticity described earlier.

• Build caching—Reproducible builds allow for better caching of intermediate build artifacts in large build graphs, such as in Bazel.

To make a build reproducible, you must remove all sources of nondeterminism and provide all information necessary to reproduce the build (known as the buildinfo). For example, if a compiler includes a timestamp in an output artifact, you must set that timestamp to a fixed value or include the timestamp in the buildinfo. In most cases, you must fully specify the full toolchain and operating system; different versions usually produce slightly different output. For practical advice, see the Reproducible Builds website.

## Verifiable

You can determine the binary provenance of an artifact—information such as what sources it was built from—in a trustworthy manner. It is usually desirable (but not strictly required) for verifiable builds to also be reproducible and hermetic.

## Implementing verifiable builds

Regardless of whether a verifiable build service is a “trusted build service” or a “rebuilding service,” you should keep several important design considerations in mind.

At a basic level, almost all CI/CD systems function according to the steps in Figure 14-4: the service takes in requests, fetches any necessary inputs, performs the build, and writes the output to a storage system.

18 As a counterexample, consider a build process that fetches the latest version of a dependency during the build but otherwise produces identical outputs. This process is reproducible so long as two builds happen at roughly the same time, but is not hermetic.

Basic CI/CD system flow diagram: a user request enters a build system, sources are fetched and additional resources may be fetched, build steps are executed, and output artifacts are sent to an output store.

Figure 14-4. A basic CI/CD system

Given such a system, you can add signed provenance to the output relatively easily, as shown in Figure 14-5. For a small organization with a “central build service” model, this additional signing step may be sufficient to address security concerns.

Flowchart of adding signing to an existing CI/CD system: a request and sources feed a build system that executes build steps, outputs artifacts, and uses a signing key to generate binary provenance attached to the output.

Figure 14-5. The addition of signing to an existing CI/CD system

As the size of your organization grows and you have more resources to invest in security, you will likely want to address two more security risks: untrusted inputs and unauthenticated inputs.

Untrusted inputs. Adversaries can potentially use the inputs to the build to subvert the build process. Many build services allow nonadministrative users to define arbitrary commands to execute during the build process—for example, through the Jenkinsfile, travis.yml, the Makefile, or BUILD. This functionality is usually necessary to support the wide variety of builds an organization needs. However, from a security perspective, this functionality is effectively “Remote Code Execution (RCE) by design.” A malicious build command running in a privileged environment could do the following:

- Steal the signing key.

• Insert false information in the provenance.

• Modify the system state, influencing subsequent builds.

• Manipulate another build that’s happening in parallel.

Even if users are not allowed to define their own steps, compilation is a very complex operation that provides ample opportunity for RCE vulnerabilities.

You can mitigate this threat via privilege separation. Use a trusted orchestrator process to set up the initial known good state, start the build, and create the signed provenance when the build is finished. Optionally, the orchestrator may fetch inputs to address the threats described in the following subsection. All user-defined build commands should execute within another environment that has no access to the signing key or any other special privileges. You can create this environment in various ways —for example, through a sandbox on the same machine as the orchestrator, or by running on a separate machine.

Unauthenticated inputs. Even if the user and build steps are trustworthy, most builds have dependencies on other artifacts. Any such dependency is a surface through which adversaries can potentially subvert the build. For example, if the build system fetches a dependency over HTTP without TLS, an attacker can perform a man-in- the-middle attack to modify the dependency in transit.

For this reason, we recommend hermetic builds (see “Hermetic, Reproducible, or Verifiable?” on page 321). The build process should declare all inputs up front, and only the orchestrator should fetch those inputs. Hermetic builds give much higher confidence that the inputs listed in the provenance are correct.

Once you’ve accounted for untrusted and unauthenticated inputs, your system resembles Figure 14-6. Such a model is much more resistant to attack than the simple model in Figure 14-5.

Seven-step CI/CD workflow diagram showing a request to an Orchestrator, source fetching and worker initialization, top-level command issuance, build-step execution, artifact output, artifact-identifier return, and binary-provenance generation before output.

Figure 14-6. An “ideal” CI/CD design that addresses risks of untrusted and unauthenticated inputs
