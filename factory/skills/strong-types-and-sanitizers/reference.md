# Security and reliability by default — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 12, “Writing Code,” by Michał Czapiński and Julian Bangert with Thomas
Maufer and Kavita Guliani. Only page furniture (page numbers, running heads,
line-break hyphens) was removed; the wording is unchanged.

---

## Security and Reliability by Default

In addition to using frameworks with strong guarantees, you can use several other techniques to automatically improve the security and reliability posture of your application, as well as that of your team culture, which you’ll read more about in Chapter 21.

## Choose the Right Tools

Choosing a language, framework, and libraries is a complicated task that’s often influenced by a combination of factors, such as these:

• Integration with the existing codebase

- Availability of libraries

• Skills or preferences of the developer team

Be aware of the enormous impact that language choice can have on the security and reliability of the project.

## Use memory-safe languages

At BlueHat Israel in February 2019, Microsoft’s Matt Miller claimed that around 70% of all security vulnerabilities are due to memory safety issues.13 This statistic has remained consistent over at least the last 12 years.

In a 2016 presentation, Nick Kralevich from Google reported that 85% of all bugs in Android (including bugs in the kernel and other components) were caused by memory management errors (slide 54).14 Kralevich concluded that “we need to move towards memory safe languages.” By using any language with higher-level memory management (such as Java or Go) rather than a language with more memory allocation difficulties (like C/C++), you can avoid this entire class of security (and reliabil‐

- 11 Wright, Hyrum et al. 2013. “Large-Scale Automated Refactoring Using Clang.” Proceedings of the 29th Inter- national Conference on Software Maintenance: 548-551. doi:10.1109/ICSM.2013.93.

- 12 Wasserman, Louis. 2013. “Scalable, Example-Based Refactorings with Refaster.” Proceedings of the 2013 ACM Workshop on Refactoring Tools: 25–28 doi:10.1145/2541348.2541355.

- 13 Miller, Matt. 2019. “Trends, Challenges, and Strategic Shifts in the Software Vulnerability Mitigation Landscape.” BlueHat IL. https://goo.gl/vKM7uQ.

- 14 Kralevich, Nick. 2016. “The Art of Defense: How Vulnerabilities Help Shape Security Features and Mitigations in Android.” BlackHat. https://oreil.ly/16rCq.

ity) vulnerabilities by default. Alternatively, you can use code sanitizers that detect most memory management pitfalls (see “Sanitize Your Code” on page 267).

## Use strong typing and static type checking

In a strongly typed language, “whenever an object is passed from a calling function to a called function, its type must be compatible with the type declared in the called function.”15 A language without that requirement is referred to as weakly or loosely typed. You can enforce type checking either during compilation (static type checking) or at runtime (dynamic type checking).

The benefits of strong typing and static type checking are especially noticeable when working on large codebases with multiple developers, as you can enforce invariants and eliminate a wide range of errors at compilation time rather than at runtime. This leads to more reliable systems, fewer security issues, and better-performing code in a production environment.

In contrast, when using dynamic type checking (for example, in Python), you can infer almost nothing about the code unless it has 100% test coverage—which is great in principle, but rarely observed in practice. Reasoning about the code becomes even harder in weakly typed languages, often leading to surprising behavior. For example, in JavaScript, every literal is by default treated as a string: [9, 8, 10].sort() -> [10, 8, 9].16 In both of these cases, because invariants aren’t enforced at compilation time, you can only capture mistakes during testing. In consequence, you more often detect reliability and security issues, especially in less frequently exercised code paths, in the production environment rather than during development.

If you want to use languages that have dynamic type checking or weak typing by default, we recommend using extensions like the following to improve the reliability of your code. These extensions offer support for stricter type checking, and you can incrementally add them to existing codebases:

	- Pytype for Python

	- TypeScript for JavaScript

- 15 Liskov, Barbara, and Stephen Zilles. 1974. “Programming with Abstract Data Types.” Proceedings of the ACM SIGPLAN Symposium on Very High Level Languages: 50–59. doi:10.1145/800233.807045

- 16 For many more surprises in JavaScript and Ruby, see Gary Bernhardt’s lightning talk from CodeMash 2012.

# Use Strong Types

Using untyped primitives (such as strings or integers) can lead to the following issues:

• Passing conceptually invalid parameters to a function

- Unwanted implicit type conversions

⚫ Difficult-to-understand type hierarchy"

• Confusing measurement units

The first situation—passing conceptually invalid parameters to a function—occurs if the primitive type of a function parameter does not have enough context, and therefore becomes confusing when it’s called. For example:

• For the function AddUserToGroup(string, string), it’s unclear whether the group name is provided as the first or the second argument.

• What is the order of height and width in the Rectangle (3.14, 5.67) constructor call?

• Does Circle(double) expect a radius or diameter?

Documentation can correct for ambiguity, but developers are still bound to make mistakes. Unit tests can catch most of these errors if we’ve done our due diligence, but some errors may surface only at runtime.

When using strong types, you can catch these mistakes at compilation time. To return to our earlier example, the required calls would look like the following:

- Add(User("alice"), Group("root-users"))

- Rectangle(Width(3.14), Height(5.67))

• Circle(Radius(1.23))

where User, Group, Width, Height, and Radius are strong type wrappers around string or double primitives. This approach is less error-prone and makes the code more self-documenting—in this context, in the first example it’s sufficient to call the function Add.

17 See Eaddy, Mark. 2017. “Code Health: Obsessed with Primitives?” https://oreil.ly/0DvJI.

In the second situation, implicit type conversions may lead to the following:

• Truncation when converting from larger to smaller integer types

• Precision loss when converting from larger to smaller floating-point types

• Unexpected object creation

In some cases, a compiler will report the first two issues (for example, when using the {} direct initialization syntax in C++), but many instances will likely be overlooked. Using strong types protects your code from errors of this type that a compiler doesn’t capture.

Now let’s consider the case of the difficult-to-understand type hierarchy:

```cpp
class Bar { public: Bar(bool is_safe) {...} }; void Foo(const Bar& bar) {...} Foo(false); // Likely OK, but is the developer aware a Bar object was created? Foo(5); // Will create Bar(is_safe := true), but likely by accident. Foo(NULL); // Will create Bar(is_safe := false), again likely by accident.
```

The three calls here will compile and execute, but will the outcome of the operation match developers’ expectations? By default, a C++ compiler attempts to implicitly cast (coerce) parameters to match function argument types. In this case, the compiler will attempt to match the type Bar, which conveniently has a single-value constructor taking a parameter of type bool. Most C++ types implicitly cast to bool.

Implicit casting in constructors is sometimes intended (for example, when converting floating-point values to the std::complex class), but can be dangerous in most situations. To prevent dangerous outcomes, at a minimum, make single-value constructors explicit—for example, explicit Bar(bool is_safe). Note that the last call will result in a compilation error when using nullptr rather than NULL because there is no implicit conversion to bool.

Finally, unit confusion is an endless source of mistakes. These mistakes might be characterized as follows:

## Harmless

For example, code that sets a timer for 30 seconds instead of 30 minutes because the programmer didn’t know what units Timer(30) uses.

## Dangerous

For example, AirCanada’s “Gimli Glider” airplane had to make an emergency landing after ground crew calculated the necessary fuel in pounds instead of kilograms, leaving it with only half the required fuel.

## Expensive

For example, scientists lost the $125 million Mars Climate Orbiter because two separate engineering teams used different units of measurement (imperial versus metric).

As before, strong types are a solution to this issue: they can encapsulate the unit, and represent only abstract concepts such as timestamp, duration, or weight. Such types typically implement the following:

## Sensible operations

For example, adding two timestamps is not normally a useful operation, but subtracting them returns a duration that can be useful for many use cases. Adding two durations or weights is similarly useful.

## Unit conversions

For example, Timestamp::ToUnix, Duration::ToHours, Weight::Tokilo
grams.

Some languages provide such abstractions natively: examples include the time package in Go and the chrono library in the upcoming C++20 standard. Other languages might require a dedicated implementation.

The Fluent C++ blog has more discussion on applications of strong types and example implementations in C++.

## Sanitize Your Code

It’s very useful to automatically validate that your code is not experiencing any typical memory management or concurrency pitfalls. You can run these checks as a presubmit action for each change list or as part of a continuous build and test automation harness. The list of pitfalls to check is language-dependent. This section presents some solutions for C++ and Go.

## C++: Valgrind or Google Sanitizers

C++ allows for low-level memory management. As we mentioned earlier, memory management errors are a leading cause of security issues, and can result in the following failure scenarios:

• Reading unallocated memory (before new or after delete)

• Reading outside of the allocated memory (buffer overflow attack scenario)

• Reading uninitialized memory

• Memory leaks when a system loses the address of allocated memory or doesn’t deallocate unused memory early

Valgrind is a popular framework that allows developers to catch those sorts of errors, even if unit tests don’t catch them. Valgrind has the benefit of providing a virtual machine that interprets a user’s binary, so users don’t need to recompile their code to use it. The Valgrind tool Helgrind can additionally detect common synchronization errors such as these:

• Misuses of the POSIX pthreads API (e.g., unlocking a not-locked mutex, or a mutex held by another thread)

• Potential deadlocks arising from lock ordering problems

• Data races caused by accessing memory without adequate locking or synchronization

Alternatively, the Google Sanitizers suite offers various components that can detect all the same issues that Valgrind’s Callgrind (a cache and branch prediction profiler) can detect:

• AddressSanitizer (ASan) detects memory errors (buffer overflows, use after free, incorrect initialization order).

• LeakSanitizer (LSan) detects memory leaks.

• MemorySanitizer (MSan) detects when a system is reading uninitialized memory.

• ThreadSanitizer (TSan) detects data races and deadlocks.

• UndefinedBehaviorSanitizer (UBSan) detects situations that have undefined behavior (using misaligned pointers; signed integer overflow; converting to, from, or between floating-point types that will overflow the destination).

The main advantage of the Google Sanitizers suite is speed: it’s up to 10 times faster than Valgrind. Popular IDEs like CLion also provide first-class integration with Google Sanitizers. The next chapter provides more details on sanitizers and other dynamic program analysis tools.

## Go: Race Detector

While Go is designed to disallow memory corruption issues typical to C++, it may still suffer from data race conditions. Go Race Detector can detect these conditions.
