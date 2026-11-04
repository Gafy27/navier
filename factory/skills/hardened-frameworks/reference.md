# Frameworks to enforce security and reliability — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 12, “Writing Code,” by Michał Czapiński and Julian Bangert with Thomas
Maufer and Kavita Guliani. Only page furniture (page numbers, running heads,
line-break hyphens) was removed; the wording is unchanged.

---

## Frameworks to Enforce Security and Reliability

As discussed in Chapter 6, the security and reliability of an application rely on domain-specific invariants. For example, an application is secure against SQL injection attacks if all of its database queries consist only of developer-controlled code, with external inputs supplied via query parameter bindings. A web application can prevent XSS attacks if all user input that’s inserted into HTML forms is properly escaped or sanitized to remove any executable code.

## Common Security and Reliability Invariants

Almost any multiuser application has application-specific security invariants that govern which users can perform which actions on data; every action should consistently maintain these invariants. To prevent cascading failures in a distributed system, each application must also follow sensible policies, such as backing off retries on failing RPCs. Similarly, in order to avoid memory corruption crashes and security issues, C++ programs should access only valid memory locations.

In theory, you can create secure and reliable software by carefully writing application code that maintains these invariants. However, as the number of desired properties and the size of the codebase grows, this approach becomes almost impossible. It’s unreasonable to expect any developer to be an expert in all these subjects, or to constantly maintain vigilance when writing or reviewing code.

If humans need to manually review every change, those humans will have a hard time maintaining global invariants because reviewers can’t always keep track of global context. If a reviewer needs to know which function parameters are passed user input by callers and which arguments only contain developer-controlled, trustworthy values, they must also be familiar with all transitive callers of a function. Reviewers are unlikely to be able to keep this state over the long run.

A better approach is to handle security and reliability in common frameworks, languages, and libraries. Ideally, libraries only expose an interface that makes writing code with common classes of security vulnerabilities impossible. Multiple applications can use each library or framework. When domain experts fix an issue, they remove it from all the applications the framework supports, allowing this engineering approach to scale better. Compared to manual review, using a centralized hardened framework also reduces the chances of future vulnerabilities creeping in. Of course, no framework can protect against all security vulnerabilities, and it is still possible for attackers to discover an unforeseen class of attacks or find mistakes in the implementation of the framework. But if you discover a new vulnerability, you can address it in one place (or a few) instead of throughout the codebase.

To provide one concrete example: SQL injection (SQLI) holds the top spot on both the OWASP and SANS lists of common security vulnerabilities. In our experience, when you use a hardened data library such as TrustedSqlString (see “SQL Injection Vulnerabilities: TrustedSqlString” on page 252), these types of vulnerabilities become a nonissue. Types make these assumptions explicit, and are automatically enforced by the compiler.

## Benefits of Using Frameworks

Most applications have similar building blocks for security (authentication and authorization, logging, data encryption) and reliability (rate limiting, load balancing, retry logic). Developing and maintaining such building blocks from scratch for every service is expensive, and leads to a patchwork of different bugs in each service.

Frameworks enable code reuse: rather than accounting for all of the security and reliability aspects affecting a given functionality or feature, developers only need to customize a specific building block. For example, a developer can specify which information from the incoming request credentials is important for authorization without worrying about the credibility of that information—that credibility is verified by the framework. Equally, a developer can specify which data needs to be logged without worrying about storage or replication. Frameworks also make propagating updates easier, as you need to apply an update in only one location.

Using frameworks leads to increased productivity for all developers in an organization, a benefit for building a culture of security and reliability (see Chapter 21). It’s much more efficient for a team of domain experts to design and develop the

framework building blocks than for each individual team to implement security and reliability features itself. For example, if the security team handles cryptography, all other teams benefit from their knowledge. None of the developers using the frameworks need to worry about their internal details, and they can instead focus on an application’s business logic.

Frameworks further increase productivity by providing tools that are easy to integrate with. For example, frameworks can provide tools that automatically export basic operational metrics, like the total number of requests, the number of failed requests broken down by error type, or the latency of each processing stage. You can use that data to generate automated monitoring dashboards and alerting for a service. Frameworks also make integrating with load-balancing infrastructure easier, so a service can automatically redirect traffic away from overloaded instances, or spin up new service instances under heavy load. As a result, services built on top of frameworks exhibit significantly higher reliability.

Using frameworks also makes reasoning about the code easy by clearly separating business logic from common functions. This enables developers to make assertions about the security or reliability of a service with more confidence. In general, frameworks lead to reduced complexity—when code across multiple services is more uniform, it’s easier to follow common good practices.

It doesn’t always make sense to develop your own frameworks. In many cases, the best strategy is to reuse existing solutions. For example, almost any security professional will advise you against designing and implementing your own cryptographic framework—instead, you might use a well-established and widely used framework such as Tink (discussed in “Example: Secure cryptographic APIs and the Tink crypto framework” on page 117).

Before deciding to adopt any specific framework, it’s important to evaluate its security posture. We also suggest using actively maintained frameworks and continuously updating your code dependencies to incorporate the latest security fixes for any code on which your code depends.

The following case study is a practical example demonstrating the benefits of frameworks: in this case, a framework for creating RPC backends.

# Example: Framework for RPC Backends

Most RPC backends follow a similar structure. They handle request-specific logic and typically also perform the following:

• Logging

⚫ Authentication

- Authorization

• Throttling (rate limiting)

Instead of reimplementing this functionality for every single RPC backend, we recommend using a framework that can hide the implementation details of these building blocks. Then developers just need to customize each step to accommodate their service’s needs.

Figure 12-1 presents a possible framework architecture based on predefined interceptors that are responsible for each of the previously mentioned steps. You can potentially also use interceptors for custom steps. Each interceptor defines an action to be performed before and after the actual RPC logic executes. Each stage can report an error condition, which prevents further interceptors from executing. However, when this occurs, the after steps of each interceptor that has already been called are executed in the reverse order. The framework between the interceptors can transparently perform additional actions—for example, exporting error rates or performance metrics. This architecture leads to a clear separation of the logic performed at every stage, resulting in increased simplicity and reliability.

Flowchart of an RPC backend control flow with logging, authentication, authorization, and rate-limiting interceptors. The request path runs through before stages and error checks, the authorization interceptor is highlighted, and after stages are called on errors before the response returns to the RPC client.

Figure 12-1. A control flow in a potential framework for RPC backends: the typical steps are encapsulated in predefined interceptors and authorization is highlighted as an example

In this example, the before stage of the logging interceptor could log the call, and the after stage could log the status of the operation. Now, if the request is unauthorized, the RPC logic doesn’t execute, but the “permission denied” error is properly logged. Afterward, the system calls the authentication and logging interceptors’ after stages (even if they are empty), and only then does it send the error to the client.

Interceptors share state through a context object that they pass to each other. For example, the authentication interceptor’s before stage can handle all the cryptographic operations associated with certificate handling (note the increased security from reusing a specialized crypto library rather than reimplementing one yourself). The system then wraps the extracted and validated information about the caller in a convenience object, which it adds to the context. Subsequent interceptors can easily access this object.

The framework can then use the context object to track request execution time. If at any stage it becomes obvious that the request won’t complete before the deadline, the system can automatically cancel the request. You can increase service reliability by notifying the client quickly, which also conserves resources.

A good framework should also enable you to work with dependencies of the RPC backend—for example, another backend that’s responsible for storing logs. You might register these as either soft or hard dependencies, and the framework can constantly monitor their availability. When it detects the unavailability of a hard dependency, the framework can stop the service, report itself as unavailable, and automatically redirect traffic to other instances.

Sooner or later, overload, network issues, or some other issue will result in a dependency being unavailable. In many cases, it would be reasonable to retry the request, but implement retries carefully in order to avoid a cascading failure (akin to falling dominoes).1 The most common solution is to retry with an exponential backoff. 2 A good framework should provide support for such logic, rather than requiring the developer to implement the logic for every RPC call.

A framework that gracefully handles unavailable dependencies and redirects traffic to avoid overloading the service or its dependencies naturally improves the reliability of both the service itself and the entire ecosystem. These improvements require minimal involvement from developers.

## Example code snippets

Examples 12-1 through 12-3 demonstrate the RPC backend developer’s perspective of working with a security- or reliability-focused framework. The examples are in Go and use Google Protocol Buffers.

- 1 See Chapter 22 of the SRE book for more on cascading failures.

- 2 Also described in Chapter 22 of the SRE book.

Example 12-1. Initial type definitions (the before stage of an interceptor can modify the context; for example, the authentication interceptor can add verified information about the caller)

```go
type Request struct {
Payload proto.Message
}

type Response struct {
Err error
Payload proto.Message
}

type Interceptor interface {
Before(context.Context, *Request) (context.Context, error)
After(context.Context, *Response) error
}

type CallInfo struct {
User string
Host string
...
}
```

Example 12-2. Example authorization interceptor that allows only requests from whitelisted users

```go
type authzInterceptor struct {
allowedRoles map[string]bool
}

func (ai *authzInterceptor) Before(ctx context.Context, req *Request) (context.Con- text, error) { // callInfo was populated by the framework. callInfo, err := FromContext(ctx) if err != nil { return ctx, err } if ai.allowedRoles[callInfo.User] { return ctx, nil } return ctx, fmt.Errorf("Unauthorized request from %q", callInfo.User) }

func (*authzInterceptor) After(ctx context.Context, resp *Response) error { return nil // Nothing left to do here after the RPC is handled. }
```

Example 12-3. Example logging interceptor that logs every incoming request (before stage) and then logs all the failed requests with their status (after stage); WithAttemptCount is a framework-provided RPC call option that implements exponential backoff

```go
type logInterceptor struct {
logger *LoggingBackendStub
}

func (*logInterceptor) Before(ctx context.Context,
req *Request) (context.Context, error) {
// callInfo was populated by the framework.
callInfo, err := FromContext(ctx)
if err != nil { return ctx, err }
logReq := &pb.LogRequest{
timestamp: time.Now().Unix(),
user: callInfo.User,
request: req.Payload,
}
resp, err := logger.Log(ctx, logReq, WithAttemptCount(3))
return ctx, err
}

func (*logInterceptor) After(ctx context.Context, resp *Response) error {
if resp.Err == nil { return nil }

logErrorReq := &pb.LogErrorRequest{
timestamp: time.Now().Unix(),
error: resp.Err.Error(),
}
resp, err := logger.LogError(ctx, logErrorReq, WithAttemptCount(3))
return err
}
```
