# Static program analysis — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 13, “Testing Code,” by Phil Ames and Franjo Ivančić with Vera Haas and
Jen Barnason. Only page furniture (page numbers, running heads, line-break
hyphens) was removed and code blocks were fenced; the wording is unchanged.

---

## Static Program Analysis

Static analysis is a means of analyzing and understanding computer programs by inspecting their source code without executing or running them. Static analyzers parse the source code and build an internal representation of the program that’s suitable for automated analysis. This approach can discover potential bugs in source code, preferably before the code is checked in or deployed in production. Numerous tools are available for various languages, as well as tools for cross-language analyses.

Static analysis tools make different tradeoffs between depth of analysis versus cost of analyzing the source code. For example, the shallowest analyzers perform simple textual or abstract syntax tree (AST)–based pattern matches. Other techniques rely on reasoning about a program’s state-based semantic constructs, and basing that reasoning on the program’s control flow and data flow.

Tools also target different analysis tradeoffs between false positives (incorrect warnings) and false negatives (missed warnings). Tradeoffs are unavoidable, partially because of the fundamental limit to static analysis: statically verifying any program is an undecidable problem—that is, it is not possible to develop an algorithm that can determine whether any given program will execute without violating any given property.

Given that constraint, tool providers focus on generating useful signals for developers at various stages of development. Depending on the integration point for static analysis engines, different tradeoffs with respect to analysis speed and expected analysis feedback are acceptable. For example, a static analysis tool that’s integrated within a code review system will likely target only newly developed source code, and will issue precise warnings that focus on very probable issues. On the other hand, source code undergoing a final predeployment release analysis for a safety-critical program (e.g., for domains like avionics software or medical device software with potential governmental certification requirements) may require more formal and stricter analysis.6

The following sections present static analysis techniques adapted for various needs during different stages of the development process. We highlight automated code inspection tools, abstract interpretation–based tools (this process is sometimes referred to as deep static analysis), and more resource-intensive approaches, such as formal methods. We also discuss how to integrate static analyzers into developer workflows.

## Automated Code Inspection Tools

Automated code inspection tools perform a syntactic analysis of source code with respect to language features and usage rules. These tools, commonly referred to as linters, generally don’t model complex program behaviors like interprocedural data flow. Because they perform relatively shallow analysis, the tools scale easily to arbitrary code sizes—they can often complete their source code analysis in about the same amount of time it takes to compile the code. Code inspection tools are also easily extensible—you can simply add new rules that cover many types of bugs, especially bugs related to language features.

6 For an example, see Bozzano, Marco et al. 2017. “Formal Methods for Aerospace Systems.” In Cyber-Physical System Design from an Architecture Analysis Viewpoint, edited by Shin Nakajima, Jean-Pierre Talpin, Masumi Toyoshima, and Huafeng Yu. Singapore: Springer.

Over the past few years, code inspection tools have focused on stylistic and readability changes, because such code improvement suggestions have a high acceptance rate by developers. Many organizations enforce style and format checks by default in order to maintain a cohesive codebase that’s easier to manage across large developer teams. These organizations also routinely run checks that reveal potential code smells and highly likely bugs.

The following example focuses on tools that perform one particular type of analysis— AST pattern matching. An AST is a tree representation of a program’s source code based on the syntactic structure of the programming language. Compilers commonly parse a given source code input file into such a representation, and then manipulate that representation during the compilation process. For example, an AST may contain a node representing an if-then-else construct, which has three child nodes: one node for the condition of the if statement, one node representing the subtree for the then branch, and another node representing the subtree of the else branch.

Error Prone for Java and Clang-Tidy for C/C++ are widely used across projects at Google. Both of these analyzers allow engineers to add custom checks. For example, as of early 2018, 162 authors had submitted 733 checks to Error Prone. For certain types of bugs, both Error Prone and Clang-Tidy can produce suggested fixes. Some compilers (like Clang and MSVC) also support the community-developed C++ core guidelines. With help from the Guideline Support Library (GSL), these guidelines prevent many common mistakes in C++ programs.

AST pattern-matching tools allow users to add new checks by writing rules on the parsed AST. For example, consider the absl-string-find-startsWith Clang-Tidy warning. The tool attempts to improve the readability and performance of code that checks for string prefix matches using the C++ string::find API: Clang-Tidy recommends using the StartsWith API provided by ABSL instead. To perform its analysis, the tool creates an AST subtree pattern that compares the output of the C++ string::find API with the integer value 0. The Clang-Tidy infrastructure provides the tooling to find AST subtree patterns in the AST representation of the program being analyzed.

Consider the following code snippet:

```cpp
std::string s = "..."; if (s.find("Hello World") == 0) { /* do something */ }
```

The absl-string-find-startsWith Clang-Tidy warning flags this code snippet and suggests that the code be changed in the following way:

```cpp
std::string s = "..."; if (absl::StartsWith(s, "Hello World")) { /* do something */ }
```

In order to suggest a fix, Clang-Tidy (conceptually speaking) provides the capability to transform an AST subtree, given a pattern. The left side of Figure 13-1 shows an

AST pattern match. (The AST subtree is simplified for the sake of clarity.) If the tool finds a matching AST subtree in the parse AST tree of the source code, it notifies the developer. AST nodes also contain line and column information, which allows the AST pattern-matcher to report a specific warning to the developer.

AST pattern-match and replacement suggestion diagram: a blue source AST with `==`, a member call to `string x`'s `find`, and `Param: p` is shown as matching a yellow replacement pattern for a function call to `absl::StartsWith` with parameters `x` and `p`.

Figure 13-1. AST pattern-match and replacement suggestion

In addition to performance and readability checks, Clang-Tidy also provides many common bug pattern checks. Consider running Clang-Tidy on the following input files:7

```console
$ cat -n sizeof.c
1 #include <string.h>
2 const char* kMessage = "Hello World!";
3 int main() {
4 char buf[128];
5 memcpy(buf, kMessage, sizeof(kMessage));
6 return 0;
7 }

$ clang-tidy sizeof.c
[...]
Running without flags.
1 warning generated.
sizeof.c:5:32: warning: 'memcpy' call operates on objects of type 'const char'
while the size is based on a different type 'const char *'
[clang-diagnostic-sizeof-pointer-memaccess]
memcpy(buf, kMessage, sizeof(kMessage));
^
sizeof.c:5:32: note: did you mean to provide an explicit length?
memcpy(buf, kMessage, sizeof(kMessage));
```

```console
$ cat -n sizeof2.c
```

7 You can install Clang-Tidy using standard package managers. It is generally called clang-tidy.

```console
1 #include <string.h>
2 const char kMessage[] = "Hello World!";
3 int main() {
4 char buf[128];
5 memcpy(buf, kMessage, sizeof(kMessage));
6 return 0;
7 }

$ clang-tidy sizeof2.c
[...]
Running without flags.
```

The two input files differ only in the type declaration of kMessage. When kMessage is defined as a pointer to initialized memory, sizeof(kMessage) returns the size of a pointer type. Therefore, Clang-Tidy produces the clang-diagnostic-sizeof- pointer-memaccess warning. On the other hand, when kMessage is of type const char[], the sizeof(kMessage) operation returns the appropriate, expected length, and Clang-Tidy doesn’t produce a warning.

For some pattern checks, in addition to reporting a warning, Clang-Tidy can suggest code fixes. The absl-string-find-startsWith Clang-Tidy warning suggestion presented earlier is one such instance. The righthand side of Figure 13-1 shows the appropriate AST-level replacement. When such suggestions are available, you can tell Clang-Tidy to automatically apply them to the input file, using the --fix command- line option.

You can also use automatically applied suggestions to update a codebase using the Clang-Tidy modernize fixes. Consider the following sequence of commands, which showcases the modernize-use-nullptr pattern. The sequence finds instances of zero-constants used for pointer assignments or comparisons, and changes them to use nullptr instead. In order to run all modernize checks, we use Clang-Tidy with the option --checks=modernize-*; then --fix applies the suggestions to the input file. At the end of the sequence of commands, we highlight the four changes by printing the transformed file (emphasis added):

```console
$ cat -n nullptr.cc
1 #define NULL 0x0
2
3 int *ret_ptr() {
4 return 0;
5 }
6
7 int main() {
8 char *a = NULL;
9 char *b = 0;
10 char c = 0;
11 int *d = ret_ptr();
12 return d == NULL ? 0 : 1;
13 }
```

```console
$ clang-tidy nullptr.cc -checks=modernize-* --fix
[...]
Running without flags.
4 warnings generated.
nullptr.cc:4:10: warning: use nullptr [modernize-use-nullptr]
return 0;
^
nullptr
nullptr.cc:4:10: note: FIX-IT applied suggested code changes
return 0;
^
nullptr.cc:8:13: warning: use nullptr [modernize-use-nullptr]
char *a = NULL;
^
nullptr
nullptr.cc:8:13: note: FIX-IT applied suggested code changes
char *a = NULL;
^
nullptr.cc:9:13: warning: use nullptr [modernize-use-nullptr]
char *b = 0;
^
nullptr
nullptr.cc:9:13: note: FIX-IT applied suggested code changes
char *b = 0;
^
nullptr.cc:12:15: warning: use nullptr [modernize-use-nullptr]
return d == NULL ? 0 : 1;
^
nullptr
nullptr.cc:12:15: note: FIX-IT applied suggested code changes
return d == NULL ? 0 : 1;
^

clang-tidy applied 4 of 4 suggested fixes.
```

```console
$ cat -n nullptr.cc
1 #define NULL 0x0
2
3 int *ret_ptr() {
4 return nullptr;
5}
6
7 int main() {
8 char *a nullptr;
9 char *b = nullptr;
10 char c = 0;
11 int *d ret_ptr();
12 return d == nullptr ? 01;
13 }
```

Other languages have similar automated code inspection tools. For example, GoVet analyzes Go source code for common suspicious constructs, Pylint analyzes Python

code, and Error Prone provides analysis and auto-fix capabilities for Java programs. The following example briefly demonstrates running Error Prone via Bazel build rule (emphasis added). In Java, the subtraction operation i-1 on the variable i of type Short returns a value of type int. Therefore, it is infeasible for the remove operation to succeed:

```java
$ cat -n ShortSet.java
1 import java.util.Set;
2 import java.util.HashSet;
3
4 public class ShortSet {
5 public static void main (String[] args) {
6 Set<Short> s = new HashSet<>();
7 for (short i = 0; i < 100; i++) {
8 s.add(i);
9 s.remove(i - 1);
10 }
11 System.out.println(s.size());
12 }
13 }
```

```console
$ bazel build :hello
ERROR: example/myproject/BUILD:29:1: Java compilation in rule '//example/mypro-
ject:hello'
ShortSet.java:9: error: [CollectionIncompatibleType] Argument 'i - 1' should
not be
passed to this method;
its type int is not compatible with its collection's type argument Short
s.remove(i - 1);
^
(see http://errorprone.info/bugpattern/CollectionIncompatibleType)
1 error
```

## Integration of Static Analysis in the Developer Workflow

It’s considered good industry practice to run relatively fast static analysis tools as early as possible in the development cycle. Finding bugs early is important because the cost of fixing them increases substantially if they’re pushed into the source code repository or deployed to users.

There’s a low barrier to integrating static analysis tools into your CI/CD pipeline, with a potentially high positive impact on the productivity of your engineers. For example, a developer can get an error and a suggestion about how to fix null pointer dereferencing. And if they can’t push their code, they can’t forget to fix the issue and accidentally cause the system to crash or expose information, which contributes to a culture of security and reliability (see Chapter 21).

To this end, Google developed the Tricorder program analysis platform" and an open-source version of Tricorder called Shipshape. Tricorder performs static analysis of approximately 50,000 code review changes per day. The platform runs many types of program analysis tools and surfaces warnings to developers during code review, when they are accustomed to evaluating suggestions. The tools aim to provide code findings that are easy to understand and easy to fix, with a low user-perceived false- positive rate (10%, at most).

Tricorder is designed to allow users to run many different program analysis tools. As of early 2018, the platform included 146 analyzers covering over 30 source languages. Most of these analyzers were contributed by Google developers. Generally speaking, commonly available static analysis tools are not very complex. Most checkers run by Tricorder are automated code inspection tools. These tools target a variety of languages, check for conformance to coding style guidelines, and find bugs. As previously mentioned, Error Prone and Clang-Tidy can produce suggested fixes in certain scenarios. The code author can then apply the fixes with the click of a button.

Figure 13-2 shows a screenshot of Tricorder analysis results for a given Java input file, as presented to a code reviewer. The results show two warnings, one from the Java linter and one from Error Prone. Tricorder measures the user-perceived false- positive rate by allowing code reviewers to provide feedback on surfaced warnings via a “Not useful” link. The Tricorder team uses these signals to disable individual checks. The code reviewer can also send a request to the code author to “Please fix” an individual warning.

8 See Sadowski, Caitlin et al. 2018. “Lessons from Building Static Analysis Tools at Google.” Communications of the ACM 61(4): 58–66. doi:10.1145/3188720.

Screenshot of static analysis results for a Java class Test, showing a lint warning for a missing Javadoc comment and an ErrorProne StringEquality warning about using reference equality instead of value equality in a string comparison.

Figure 13-2. Screenshot of static analysis results during code review provided via Tricorder

Figure 13-3 shows the automatically applied code changes suggested by Error Prone during code review.

Side-by-side preview of an Error Prone fix for a string-equality issue in `Test.java`. The left pane shows the original `foo` method using `==` to compare `getString()` with `"foo".toString()`; the right pane shows the proposed change to `Objects.equals(getString(), "foo".toString())`, with `java.util.Objects` imported. The comparison line is highlighted in red on the left and green on the right, and `Apply` and `Cancel` buttons appear below.

Figure 13-3. Screenshot of the preview fix view for the Error Prone warning from Figure 13-2

## Reverse Engineering and Test Input Generation

Program analysis techniques, both static and dynamic, have been used for purposes beyond testing and ensuring code correctness—for example, to reverse engineer software. Reverse engineering can be useful when trying to understand the behavior of binaries where source code is not available. A common use case for reverse engineering occurs when a security engineer is trying to understand a potentially malicious binary. This analysis often involves using so-called decompilers or disassemblers: a disassembler translates machine language into assembly code, while a decompiler translates from machine language to source code. These tools do not guarantee that they can re-create the original source code itself. However, the generated code can

help a security engineer who is trying to understand the program and its behavior. One popular tool for reverse engineering is Ghidra.

Some engineers also use program analysis techniques to help with test input generation. One technique that has recently become popular, concolic testing, combines a regular execution (called a concrete execution since it utilizes concrete values) with symbolic analysis techniques (hence the name concolic—concrete + symbolic). Users can then automatically generate test inputs that are guaranteed to cover some other execution paths in the target program. Concolic tests can make this guarantee by executing a given program given a concrete input (e.g., the integer value 123), while shadowing each execution step with a formula that corresponds to the observed statements and branches. For example, you might substitute the concrete input value 123 with the symbol α. As the execution proceeds, at every branch point, such as an if statement, concolic execution asks a constraint solver whether it is possible to find a different value for α that would lead down the alternative branch. With each collected input value, you can start new concolic executions that increase branch coverage. KLEE is one popular concolic testing tool.

## Abstract Interpretation

Abstract interpretation–based tools statically perform a semantic analysis of program behaviors.9 This technique has been used successfully to verify safety-critical software, such as flight control software.10 Consider the simple example of a program that generates the 10 smallest positive even integers. During its regular execution, the program generates the integer values 2, 4, 6, 8, 10, 12, 14, 16, 18, and 20. In order to allow efficient static analysis of such a program, we want to summarize all the possible values using a compact representation that covers all the observed values. Using the so- called interval or range domain, we can represent all observed values using the abstract interval value [2, 20] instead. The interval domain allows the static analyzer to reason efficiently about all program executions by simply remembering the lowest and highest possible values.

In order to ensure that we’re capturing all possible program behaviors, it’s important to cover all observed values with the abstract representation. However, this approach also introduces an approximation that may lead to imprecision, or false warnings. For example, if we wanted to guarantee that the actual program never produces the value 11, an analysis using an integer domain would lead to a false positive.

- 9 See Cousot, Patrick, and Radhia Cousot. 1976. “Static Determination of Dynamic Properties of Programs.” Proceedings of the 2nd International Symposium on Programming: 106–130. https://oreil.ly/4xLgB.

- 10 Souyris, Jean et al. 2009. “Formal Verification of Avionics Software Products.” Proceedings of the 2nd World Conference on Formal Methods: 532–546. doi:10.1007/978-3-642-05089-3_34.

Static analyzers utilizing abstract interpretation generally compute an abstract value for every program point. To do so, they rely on a control-flow graph (CFG) representation of a program. CFGs are commonly used during compiler optimizations, and to statically analyze programs. Each node in a CFG represents a basic block in the program, which corresponds to a sequence of program statements that are always executed in order. That is, there are no jumps from within this sequence of statements, and no jump targets in the middle of the sequence. Edges in a CFG represent control flow in the program, where a jump occurs either through intraprocedural control flow—for example, due to if statements or loop constructs—or interprocedural control flow due to function calls. Note that the CFG representation is also used by coverage-guided fuzzers (discussed previously). For instance, libFuzzer keeps track of which basic blocks and edges are covered during fuzzing. The fuzzer uses this information to decide whether to consider an input for future mutations.

Abstract interpretation–based tools perform a semantic analysis that reasons about data flow and control flow in programs, often across function calls. For that reason, they take much longer to run than the previously discussed automated code inspection tools. While you can integrate automated code inspection tools into interactive development environments such as code editors, abstract interpretation is generally not similarly integrated. Instead, developers might run abstract interpretation–based tools on committed code occasionally (nightly, for example), or during code review in differential settings, analyzing only the changed code while reusing analysis facts for unchanged code.

A number of tools rely on abstract interpretation for a variety of languages and properties. For example, the Frama-C tool allows you to find common runtime errors and assertion violations including buffer overflows, segmentation faults due to dangling or null pointers, and division by zero in programs written in C. As previously discussed, these types of bugs—especially memory-related bugs—can have security implications. The Infer tool reasons about memory and pointer changes performed by programs and can find bugs like dangling pointers in Java, C, and other languages. The AbsInt tool can perform worst-case execution time analysis of tasks in real-time systems. The App Security Improvement (ASI) program performs a sophisticated interprocedural analysis on every Android app that’s uploaded to the Google Play Store, for safety and security. If it finds a vulnerability, ASI flags the vulnerability and presents suggestions for addressing the issue. Figure 13-4 shows a sample security alert. As of early 2019, this program had led to over one million app fixes in the Play Store by over 300,000 app developers.

App listing screenshot with a security alert for “Test App: Vungle Alert 1.0.0,” warning that the app statically links against a Vungle ad library version with multiple security vulnerabilities.

Figure 13-4. An App Security Improvement alert

## Formal Methods

Formal methods allow users to specify properties of interest for software or hardware systems. Most of these are so-called safety properties that specify that a certain bad behavior should never be observable. For example, “bad behavior” can include assertions in programs. Others include liveness properties, which allow users to specify a desired outcome—for example, that a submitted print job is eventually processed by a printer. Users of formal methods can verify these properties for particular systems or models, and even develop such systems using correct-by-construction–based approaches. As highlighted in “Analyzing Invariants” on page 92, formal methods– based approaches often have a relatively high up-front cost. This is partially because these approaches require an a priori description of system requirements and properties of interest. These requirements must be specified in a mathematically rigorous and formal way.

Formal methods–based techniques have been successfully integrated into hardware design and verification tools.11 In hardware design, it is now standard practice to use formal or semiformal tools provided by electronic design automation (EDA) vendors. These techniques have also been successfully applied to software in specialized domains, such as safety-critical systems or cryptographic protocol analysis. For example, a formal methods–based approach continuously analyzes the cryptographic protocols used in TLS within computer network communications.12

- 11 See, e.g., Kern, Christoph, and Mark R. Greenstreet. 1999. “Formal Verification in Hardware Design: A Survey.” ACM Transactions on Design Automation of Electronic Systems 4(2): 123–193. doi: 10.1145/307988.307989. See also Hunt Jr. et al. 2017. “Industrial Hardware and Software Verification with ACL2.” Philosophical Transactions of The Royal Society A Mathematical Physical and Engineering Sciences 375(2104): 20150399. doi: 10.1098/rsta.2015.0399.

- 12 See Chudnov, Andrey et al. 2018. “Continuous Formal Verification of Amazon s2n.” Proceedings of the 30th International Conference on Computer Aided Verification: 430–446. doi:10.1007/978-3-319-96142-2_26.
