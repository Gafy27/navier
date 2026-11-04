# Threat model and mitigation mapping — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 14, “Deploying Code,” by Jeremiah Spradlin and Mark Lodato with Sergey
Simakov and Roxana Loza. Only page furniture (page numbers, running heads,
line-break hyphens) was removed and the one JSON block was fenced; the wording
is unchanged.

---

## Threat Model

Before hardening your software supply chain to mitigate threats, you have to identify your adversaries. For the purpose of this discussion, we’ll consider the following three types of adversaries. Depending on your system and organization, your list of adversaries may differ:

• Benign insiders who may make mistakes

• Malicious insiders who try to gain more access than their role allows

• External attackers who compromise the machine or account of one or more insiders

Chapter 2 describes attacker profiles and provides guidance on how to model against insider risk.

Next, you must think like an attacker and try to identify all the ways an adversary can subvert the software supply chain to compromise your system. The following are some examples of common threats; you should tailor this list to reflect the specific threats to your organization. For the sake of simplicity, we use the term engineer to refer to benign insiders, and malicious adversary to refer to both malicious insiders and external attackers:

• An engineer submits a change that accidentally introduces a vulnerability to the system.

• A malicious adversary submits a change that enables a backdoor or introduces some other intentional vulnerability to the system.

• An engineer accidentally builds from a locally modified version of the code that contains unreviewed changes.

• An engineer deploys a binary with a harmful configuration. For example, the change enables debug features in production that were intended only for testing.

• A malicious adversary deploys a modified binary to production that begins exfiltrating customer credentials.

• A malicious adversary modifies the ACLs of a cloud bucket, allowing them to exfiltrate data.

• A malicious adversary steals the integrity key used to sign the software.

• An engineer deploys an old version of the code with a known vulnerability.

• The CI system is misconfigured to allow requests to build from arbitrary source repositories. As a result, a malicious adversary can build from a source repository containing malicious code.

• A malicious adversary uploads a custom build script to the CI system that exfiltrates the signing key. The adversary then uses that key to sign and deploy a malicious binary.

• A malicious adversary tricks the CD system to use a backdoored compiler or build tool that produces a malicious binary.

Once you’ve compiled a comprehensive list of potential adversaries and threats, you can map the threats you identified to the mitigations you already have in place. You should also document any limitations of your current mitigation strategies. This exercise will provide a thorough picture of the potential risks in your system. Threats that don’t have corresponding mitigations, or threats for which existing mitigations have significant limitations, are areas for improvement.

## Securing Against the Threat Model

Now that we’ve defined some best practices, we can map those processes to the threats we identified earlier. When evaluating these processes with respect to your specific threat model, ask yourself: Are all of the best practices necessary? Do they sufficiently mitigate all the threats? Table 14-1 lists example threats, along with their corresponding mitigations and potential limitations of those mitigations.

10 You must log and audit these manual overrides, lest an adversary use manual overrides as an attack vector.

## Table 14-1. Example threats, mitigations, and potential limitations of mitigations

<table><tr><th>Threat</th><th>Mitigation</th><th>Limitations</th></tr><tr><td>An engineer submits a change that
accidentally introduces a vulnerability
to the system.</td><td>Code review plus automated testing (see Chapter 13).
This approach significantly reduces the chance of
mistakes.</td><td></td></tr><tr><td>A malicious adversary submits a
change that enables a backdoor or
introduces some other intentional
vulnerability to the system.</td><td>Code review. This practice increases the cost for
attacks and the chance of detection—the adversary
has to carefully craft the change to get it past code
review.</td><td>Does not protect against
collusion or external
attackers who are able to
compromise multiple insider
accounts.</td></tr><tr><td>An engineer accidentally builds from
a locally modified version of the code
that contains unreviewed changes.</td><td>An automated CI/CD system that always pulls from the
correct source repository performs builds.</td><td></td></tr><tr><td>An engineer deploys a harmful
configuration. For example, the
change enables debug features in
production that were intended only
for testing.</td><td>Treat configuration the same as source code, and
require the same level of peer review.</td><td>Not all configuration can be
treated “as code.”</td></tr><tr><td>A malicious adversary deploys a
modified binary to production that
begins exfiltrating customer
credentials.</td><td>The production environment requires proof that the
CI/CD system built the binary. The CI/CD system is
configured to pull sources from only the correct source
repository.</td><td>An adversary may figure out
how to bypass this
requirement by using
emergency deployment
breakglass procedures (see
“Practical Advice” on page
328). Sufficient logging and
auditing can mitigate this
possibility.</td></tr><tr><td>A malicious adversary modifies the
ACLs of a cloud bucket, allowing
them to exfiltrate data.</td><td>Consider resource ACLs as configuration. The cloud
bucket only allows configuration changes by the
deployment process, so humans can’t make changes.</td><td>Does not protect against
collusion or external
attackers who are able to
compromise multiple insider
accounts.</td></tr><tr><td>A malicious adversary steals the
integrity key used to sign the
software.</td><td>Store the integrity key in a key management system
that is configured to allow only the CI/CD system to
access the key, and that supports key rotation. For
more information, see Chapter 9. For build-specific
suggestions, see the recommendations in “Advanced
Mitigation Strategies” on page 314.</td><td></td></tr></table>

Figure 14-3 shows an updated software supply chain that includes the threats and mitigations listed in the preceding table.

Software supply-chain flowchart showing a left-to-right process from Source to Build, Test, and Deploy, with a green check before Source and red X callouts for Unreviewed Code, Unsubmitted Code, Improperly Built Code, and Untested Code.

Figure 14-3. A typical software supply chain—adversaries should not be able to bypass the process

We have yet to match several threats with mitigations from best practices:

• An engineer deploys an old version of the code with a known vulnerability.

• The CI system is misconfigured to allow requests to build from arbitrary source repositories. As a result, a malicious adversary can build from a source repository containing malicious code.

• A malicious adversary uploads a custom build script to the CI system that exfiltrates the signing key. The adversary then uses that key to sign and deploy a malicious binary.

• A malicious adversary tricks the CD system to use a backdoored compiler or build tool that produces a malicious binary.

To address these threats, you need to implement more controls, which we cover in the following section. Only you can decide whether these threats are worth addressing for your particular organization.

## Trusting Third-Party Code

Modern software development commonly makes use of third-party and open source code. If your organization relies upon these types of dependencies, you need to figure out how to mitigate the risks they pose.

If you fully trust the people who maintain the project, the code review process, the version control system, and the tamper-proof import/export process, then importing third-party code into your build is straightforward: pull in the code as though it originated from any of your first-party version control systems.

However, if you have less than full trust in the people who maintain the project or the version control system, or if the project doesn’t guarantee code reviews, then you’ll

want to perform some level of code review prior to build. You may even keep an internal copy of the third-party code and review all patches pulled from upstream.

The level of review will depend on your level of trust in the vendor. It’s important to understand the third-party code you use and to apply the same level of rigor to third- party code as you apply to first-party code.

Regardless of your trust in the vendor, you should always monitor your dependencies for vulnerability reports and quickly apply security patches.

## Securing Against the Threat Model, Revisited

We can now map advanced mitigations to our previously unaddressed threats, as shown in Table 14-2.

## Table 14-2. Advanced mitigations to complex threat examples

<table><tr><th>Threat</th><th>Mitigation</th></tr><tr><td>An engineer deploys an old version of the code with a
known vulnerability.</td><td>The deployment policy requires the code to have undergone a
security vulnerability scan within the last N days.</td></tr><tr><td>The CI system is misconfigured to allow requests to build
from arbitrary source repositories. As a result, a malicious
adversary can build from a source repository containing
malicious code.</td><td>The CI system generates binary provenance describing what
source repository it pulled from. The production environment
enforces a deployment policy requiring provenance to prove
that the deployed artifact originated from an approved source
repository.</td></tr><tr><td>A malicious adversary uploads a custom build script to the
CI system that exfiltrates the signing key. The adversary
then uses that key to sign and deploy a malicious binary.</td><td>The verifiable build system separates privileges so that the
component that runs custom build scripts does not have access
to the signing key.</td></tr><tr><td>A malicious adversary tricks the CD system to use a
backdoored compiler or build tool that produces a malicious
binary.</td><td>Hermetic builds require developers to explicitly specify the
choice of compiler and build tool in the source code. This choice
is peer reviewed like all other code.</td></tr></table>

With appropriate security controls around your software supply chain, you can mitigate even advanced and complex threats.
