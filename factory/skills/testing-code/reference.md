# Chapter 13 introduction and conclusion — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 13, “Testing Code,” by Phil Ames and Franjo Ivančić with Vera Haas and
Jen Barnason. Only page furniture (page numbers, running heads, line-break
hyphens) was removed and code blocks were fenced; the wording is unchanged.

---

# CHAPTER 13
Testing Code

By Phil Ames and Franjo Ivančić with Vera Haas and Jen Barnason

A reliable system is resilient to failures and meets its documented service level objectives, which may also include security guarantees. Robust software testing and analysis are useful aids in mitigating failure risks, and should be a particular focus during the project implementation phase.

In this chapter, we discuss several approaches to testing, including unit and integration testing. We also cover additional security deep-dive topics like static and dynamic program analysis and fuzz testing, which can help strengthen your software’s resilience against the inputs it encounters.

No matter how careful the engineers developing your software are, some mistakes and overlooked edge cases are inevitable. Unexpected input combinations may trigger data corruption or result in availability issues like the “Query of Death” example in Chapter 22 of the SRE book. Coding errors can cause security problems like buffer overflows and cross-site scripting vulnerabilities. Put simply, there are many ways software is prone to failure in the real world.

The techniques discussed in this chapter, used in different stages and contexts of software development, have a variety of cost–benefit profiles.1 For example, fuzzing— sending random requests to a system—can help you harden that system in terms of both security and reliability. This technique can potentially help you catch

1 We recommend checking out Chapter 17 of the SRE book for a reliability-focused perspective.

information leaks and reduce serving errors by exposing the service to a multitude of edge cases. To identify potential bugs in systems that you can’t patch easily and quickly, you’ll likely need to perform thorough up-front testing.

## Conclusion

Testing software for security and reliability is a vast topic, of which we’ve just scratched the surface. The testing strategies presented in this chapter, combined with practices around writing secure code to eliminate entire bug classes (see Chapter 12), have been key in helping Google teams scale reliably, minimizing outages and security problems. It’s important to build software with testability in mind from the earliest stages of development, and to engage in comprehensive testing throughout the development lifecycle.

At this point, we want to emphasize the value of fully integrating all of these testing and analysis methods into your engineering workflows and CI/CD pipelines. By combining and regularly using these techniques consistently throughout your codebase, you can identify bugs more quickly. You’ll also raise confidence in your ability to detect or prevent bugs when you deploy your applications—a topic covered in the next chapter.
