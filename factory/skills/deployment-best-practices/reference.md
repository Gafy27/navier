# Best practices — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 14, “Deploying Code,” by Jeremiah Spradlin and Mark Lodato with Sergey
Simakov and Roxana Loza. Only page furniture (page numbers, running heads,
line-break hyphens) was removed and the one JSON block was fenced; the wording
is unchanged.

---

## Best Practices

The following best practices can help you mitigate threats, fill any security gaps you identified in your threat model, and continuously improve the security of your software supply chain.

## Require Code Reviews

Code review is the practice of having a second person (or several people) review changes to the source code before those changes are checked in or deployed.1 In addition to improving code security, code reviews provide multiple benefits for a software project: they promote knowledge sharing and education, instill coding norms, improve code readability, and reduce mistakes,2 all of which helps to build a culture of security and reliability (for more on this idea, see Chapter 21).

From a security perspective, code review is a form of multi-party authorization,³ meaning that no individual has the privilege to submit changes on their own. As described in Chapter 5, multi-party authorization provides many security benefits.

To be implemented successfully, code reviews must be mandatory. An adversary will not be deterred if they can simply opt out of the review! Reviews must also be comprehensive enough to catch problems. The reviewer must understand the details of

- 1 Code reviews also apply to changes to configuration files; see “Treat Configuration as Code” on page 310.

- 2 Sadowski, Caitlin et al. 2018. “Modern Code Review: A Case Study at Google.” Proceedings of the 40th International Conference on Software Engineering: 181–190. doi:10.1145/3183519.3183525.

- 3 When combined with configuration-as-code and the deployment policies described in this chapter, code reviews form the basis of a multi-party authorization system for arbitrary systems.

any change and its implications for the system, or ask the author for clarifications— otherwise, the process can devolve into rubber-stamping.4

Many publicly available tools allow you to implement mandatory code reviews. For example, you can configure GitHub, GitLab, or BitBucket to require a certain number of approvals for every pull/merge request. Alternatively, you can use standalone review systems like Gerrit or Phabricator in combination with a source repository configured to accept only pushes from that review system.

Code reviews have limitations with respect to security, as described in the introduction to Chapter 12. Therefore, they are best implemented as one “defense in depth” security measure, alongside automated testing (described in Chapter 13) and the recommendations in Chapter 12.

## Rely on Automation

Ideally, automated systems should perform most of the steps in the software supply chain.5 Automation provides a number of advantages. It can provide a consistent, repeatable process for building, testing, and deploying software. Removing humans from the loop helps prevent mistakes and reduces toil. When you run the software supply chain automation on a locked-down system, you harden the system from subversion by malicious adversaries.

Consider a hypothetical scenario in which engineers manually build “production” binaries on their workstations as needed. This scenario creates many opportunities to introduce errors. Engineers can accidentally build from the wrong version of the code or include unreviewed or untested code changes. Meanwhile, malicious adversaries— including external attackers who have compromised an engineer’s machine—might intentionally overwrite the locally built binaries with malicious versions. Automation can prevent both of these outcomes.

Adding automation in a secure manner can be tricky, as an automated system itself might introduce other security holes. To avoid the most common classes of vulnerabilities, we recommend, at minimum, the following:

Move all build, test, and deployment steps to automated systems.

At a minimum, you should script all steps. This allows both humans and automation to execute the same steps for consistency. You can use CI/CD systems (such as Jenkins) for this purpose. Consider establishing a policy that requires

- 4 For more on the responsibilities of the code reviewer, see “Culture of Review” on page 474.

- 5 The chain of steps need not be fully automatic. For example, it is usually acceptable for a human to be able to initiate a build or deployment step. However, the human should not be able to influence the behavior of that step in any meaningful way.

automation for all new projects, since retrofitting automation into existing systems can often be challenging.

Require peer review for all configuration changes to the software supply chain. Often, treating configuration as code (as discussed shortly) is the best way to accomplish this. By requiring review, you greatly decrease your chances of making errors and mistakes, and increase the cost of malicious attacks.

Lock down the automated system to prevent tampering by administrators or users. This is the most challenging step, and implementation details are beyond the scope of this chapter. In short, consider all of the paths where an administrator could make a change without review—for example, making a change by configuring the CI/CD pipeline directly or using SSH to run commands on the machine. For each path, consider a mitigation to prevent such access without peer review.

For further recommendations on locking down your automated build system, see “Verifiable Builds” on page 319.

Automation is a win-win, reducing toil while simultaneously increasing reliability and security. Rely on automation whenever possible!

## Verify Artifacts, Not Just People

The controls around the source, build, and test infrastructure have limited effect if adversaries can bypass them by deploying directly to production. It is not sufficient to verify who initiated a deployment, because that actor may make a mistake or may be intentionally deploying a malicious change.6 Instead, deployment environments should verify what is being deployed.

Deployment environments should require proof that each automated step of the deployment process occurred. Humans must not be able to bypass the automation unless some other mitigating control checks that action. For example, if you run on Google Kubernetes Engine (GKE), you can use Binary Authorization to by default accept only images signed by your CI/CD system, and monitor the Kubernetes cluster audit log for notifications when someone uses the breakglass feature to deploy a noncompliant image.7

One limitation of this approach is that it assumes that all components of your setup are secure: that the CI/CD system accepts build requests only for sources that are allowed in production, that the signing keys (if used) are accessible only by the

- 6 That said, such authorization checks are still necessary for the principle of least privilege (see Chapter 5).

7 A breakglass mechanism can bypass policies to allow engineers to quickly resolve outages. See “Breakglass” on page 67.

CI/CD system, and so on. “Advanced Mitigation Strategies” on page 314 describes a more robust approach of directly verifying the desired properties with fewer implicit assumptions.

## Treat Configuration as Code

A service’s configuration is just as critical to security and reliability as the service’s code. Therefore, all the best practices regarding code versioning and change review apply to configuration as well. Treat configuration as code by requiring that configuration changes be checked in, reviewed, and tested prior to deployment, just like any other change.8

To provide an example: suppose your frontend server has a configuration option to specify the backend. If someone were to point your production frontend to a testing version of the backend, you’d have a major security and reliability problem.

Or, as a more practical example, consider a system that uses Kubernetes and stores the configuration in a YAML file under version control.9 The deployment process calls the kubectl binary and passes in the YAML file, which deploys the approved configuration. Restricting the deployment process to use only “approved” YAML— YAML from version control with required peer review—makes it much more difficult to misconfigure your service.

You can reuse all of the controls and best practices this chapter recommends to protect your service’s configuration. Reusing these approaches is usually much easier than other methods of securing post-deployment configuration changes, which often require a completely separate multi-party authorization system.

The practice of versioning and reviewing configuration is not nearly as widespread as code versioning and review. Even organizations that implement configuration-as- code usually don’t apply code-level rigor to configuration. For example, engineers generally know that they shouldn’t build a production version of a binary from a locally modified copy of the source code. Those same engineers might not think twice before deploying a configuration change without first saving the change to version control and soliciting review.

Implementing configuration-as-code requires changes to your culture, tooling, and processes. Culturally, you need to place importance on the review process. Technically, you need tools that allow you to easily compare proposed changes (i.e.,

- 8 This concept is discussed in more detail in Chapter 8 of the SRE book and Chapters 14 and 15 of the SRE workbook. The recommendations in all of those chapters apply here.

- 9 YAML is the configuration language used by Kubernetes.

diff, grep) and that provide the ability to manually override changes in case of emergency.10

## Don’t Check In Secrets!

Passwords, cryptographic keys, and authorization tokens are often necessary for a service to operate. The security of your system depends on maintaining the confidentiality of these secrets. Fully protecting secrets is outside the scope of this chapter, but we’d like to highlight several important tips:

• Never check secrets into version control or embed secrets into source code. It may be feasible to embed encrypted secrets into source code or environment variables—for example, to be decrypted and injected by a build system. While this approach is convenient, it may make centralized secret management more difficult.

• Whenever possible, store secrets in a proper secret management system, or encrypt secrets with a key management system such as Cloud KMS.

• Strictly limit access to the secrets. Only grant services access to secrets, and only when needed. Never grant humans direct access. If a human needs access to a secret, it’s probably a password, not an application secret. Where this is a valid use, create separate credentials for humans and services.
