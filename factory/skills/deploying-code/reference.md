# Chapter 14 introduction, terminology, and conclusion — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 14, “Deploying Code,” by Jeremiah Spradlin and Mark Lodato with Sergey
Simakov and Roxana Loza. Only page furniture (page numbers, running heads,
line-break hyphens) was removed and the one JSON block was fenced; the wording
is unchanged.

---

## CHAPTER 14

# Deploying Code

By Jeremiah Spradlin and Mark Lodato with Sergey Simakov and Roxana Loza

Is the code running in your production environment the code you assume it is? Your system needs controls to prevent or detect unsafe deployments: the deployment itself introduces changes to your system, and any of those changes might become a reliability or security issue. To keep from deploying unsafe code, you need to implement controls early in the software development lifecycle. This chapter begins by defining a software supply chain threat model and sharing some best practices to protect against those threats. We then deep dive into advanced mitigation strategies such as verifiable builds and provenance-based deployment policies, and conclude with some practical advice about how to deploy such changes.

Previous chapters addressed how to consider security and reliability when writing and testing your code. However, that code has no real impact until it’s built and deployed. Therefore, it’s important to carefully consider security and reliability for all elements of the build and deployment process. It can be difficult to determine if a deployed artifact is safe purely by inspecting the artifact itself. Controls on various stages of the software supply chain can increase your confidence in the safety of a software artifact. For example, code reviews can reduce the chance of mistakes and deter adversaries from making malicious changes, and automated tests can increase your confidence that the code operates correctly.

Controls built around the source, build, and test infrastructure have limited effect if adversaries can bypass them by deploying directly to your system. Therefore, systems should reject deployments that don’t originate from the proper software supply

chain. To meet this requirement, each step in the supply chain must be able to offer proof that it has executed properly.

## Concepts and Terminology

We use the term software supply chain to describe the process of writing, building, testing, and deploying a software system. These steps include the typical responsibilities of a version control system (VCS), a continuous integration (CI) pipeline, and a continuous delivery (CD) pipeline.

While implementation details vary across companies and teams, most organizations have a process that looks something like Figure 14-1:

1. Code must be checked into a version control system.

2. Code is then built from a checked-in version.

3. Once built, the binary must be tested.

4. Code is then deployed to some environment where it is configured and executed.

High-level software supply chain flowchart with four sequential stages: Source → Build → Test → Deploy.

Figure 14-1. A high-level view of a typical software supply chain

Even if your supply chain is more complicated than this model, you can usually break it into these basic building blocks. Figure 14-2 shows a concrete example of how a typical deployment pipeline executes these steps.

You should design the software supply chain to mitigate threats to your system. This chapter focuses on mitigating threats presented by insiders (or malicious attackers impersonating insiders), as defined in Chapter 2, without regard to whether the insider is acting with malicious intent. For example, a well-meaning engineer might unintentionally build from code that includes unreviewed and unsubmitted changes, or an external attacker might attempt to deploy a backdoored binary using the privileges of a compromised engineer’s account. We consider both scenarios equally.

In this chapter, we define the steps of the software supply chain rather broadly.

A build is any transformation of input artifacts to output artifacts, where an artifact is any piece of data—for example, a file, a package, a Git commit, or a virtual machine (VM) image. A test is a special case of a build, where the output artifact is some logical result—usually “pass” or “fail”—rather than a file or executable.

Flowchart of a typical cloud-hosted container-based service deployment: a developer submits code to version control, CI builds a Docker container from version control, uploads the container to a container registry, tests it in a test environment, deploys it to production, and an ops engineer verifies the tests before deployment.

Figure 14-2. Typical cloud-hosted container-based service deployment

Builds can be chained together, and an artifact can be subject to multiple tests. For example, a release process might first “build” binaries from source code, then “build” a Docker image from the binaries, and then “test” the Docker image by running it in a development environment.

A deployment is any assignment of some artifact to some environment. You can consider each of the following to be a deployment:

- Pushing code:

	— Issuing a command to cause a server to download and run a new binary

	— Updating a Kubernetes Deployment object to pick up a new Docker image

	— Booting a VM or physical machine, which loads initial software or firmware

• Updating configuration:

	— Running a SQL command to change a database schema

	— Updating a Kubernetes Deployment object to change a command-line flag

• Publishing a package or other data, which will be consumed by other users:

	— Uploading a deb package to an apt repository

	— Uploading a Docker image to a container registry

	— Uploading an APK to the Google Play Store

Post-deployment changes are out of scope for this chapter.

## Conclusion

The recommendations in this chapter can help you harden your software supply chain against various insider threats. Code reviews and automation are essential tactics for preventing mistakes and increasing attack costs for malicious actors. Configuration-as-code extends those benefits to configuration, which traditionally receives much less scrutiny than code. Meanwhile, artifact-based deployment controls, particularly those involving binary provenance and verifiable builds, bring protection against sophisticated adversaries and allow you to scale as your organization grows.

Together, these recommendations help ensure that the code you wrote and tested (following the principles in Chapters 12 and 13) is the code that’s actually deployed in production. Despite your best efforts, however, your code probably won’t always behave as expected. When that happens, you can use some of the debugging strategies presented in the next chapter.
