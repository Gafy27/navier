# Common security vulnerabilities — source extract

Verbatim extract from *Building Secure and Reliable Systems* (O'Reilly, 2020),
Chapter 12, “Writing Code,” by Michał Czapiński and Julian Bangert with Thomas
Maufer and Kavita Guliani. Only page furniture (page numbers, running heads,
line-break hyphens) was removed; the wording is unchanged.

---

## Common Security Vulnerabilities

In large codebases, a handful of classes account for the majority of security vulnerabilities, despite ongoing efforts to educate developers and introduce code review. OWASP and SANS publish lists of common vulnerability classes. Table 12-1 lists the 10 most common vulnerability risks according to OWASP, along with some potential approaches to mitigate each at a framework level.

## Table 12-1. Top 10 most common vulnerability risks according to OWASP

<table><tr><th>OWASP top 10
vulnerability</th><th>Framework hardening measures</th></tr><tr><td>[SQL] Injection</td><td>TrustedSQLString (see the following section).</td></tr><tr><td>Broken authentication</td><td>Require authentication using a well-tested mechanism like OAuth before routing a request to
the application. (See “Example: Framework for RPC Backends” on page 247.)</td></tr><tr><td>Sensitive data exposure</td><td>Use distinct types (instead of strings) to store and handle sensitive data like credit card
numbers. This approach can restrict serialization to prevent leaks and enforce appropriate
encryption.
Frameworks can additionally enforce transparent in-transit protection, like HTTPS with
LetsEncrypt. Cryptographic APIs such as Tink can encourage appropriate secret storage, such as
loading keys from a cloud key management system instead of a configuration file.</td></tr><tr><td>XML external entities (XXE)</td><td>Use an XML parser without XXE enabled; ensure this risky feature is disabled in libraries that
support it.a</td></tr><tr><td>Broken access control</td><td>This is a tricky problem, because it’s often application-specific. Use a framework that requires
every request handler or RPC to have well-defined access control restrictions. If possible, pass
end-user credentials to the backend, and enforce an access control policy in the backend.</td></tr><tr><td>Security misconfiguration</td><td>Use a technology stack that provides secure configurations by default and restricts or doesn’t
allow risky configuration options. For example, use a web framework that does not print error
information in production. Use a single flag to enable all debug features, and set up your
deployment and monitoring infrastructure to ensure this flag is not enabled for public users.
The environment flag in Rails is one example of this approach.</td></tr><tr><td>Cross-site scripting (XSS)</td><td>Use an XSS-hardened template system (see “Preventing XSS: SafeHtml” on page 254).</td></tr><tr><td>Insecure deserialization</td><td>Use deserialization libraries that are built for handling untrusted inputs, such as Protocol
Buffers.</td></tr><tr><td>Using components with
known vulnerabilities</td><td>Choose libraries that are popular and actively maintained. Do not pick components that have a
history of unfixed or slowly fixed security issues. Also see “Lessons for Evaluating and Building
Frameworks” on page 256.</td></tr><tr><td>Insufficient logging &amp;
monitoring</td><td>Instead of relying on ad hoc logging, log and monitor requests and other events as appropriate
in a low-level library. See the logging interceptor described in the previous section for an
example.</td></tr></table>

a See the XXE Prevention Cheat Sheet for more information.

## SQL Injection Vulnerabilities: TrustedSqlString

SQL injection is a common class of security vulnerability. When untrustworthy string fragments are inserted into a SQL query, attackers can potentially inject database commands. The following is a simple password reset web form:

```sql
db.query("UPDATE users SET pw_hash = '" + request["pw_hash"] + "' WHERE reset_token = '" + request.params["reset_token"] + "'")
```

In this case, the user’s request is directed to a backend with an unguessable reset_token specific to their account. However, because of the string concatenation, a malicious user could craft a custom reset_token with extra SQL commands (such

as ' or username='admin) and inject this token into the backend. The result could reset the password hash of a different user—in this case, the admin account.

SQL injection vulnerabilities can be harder to spot in more complicated codebases. The database engine can help you prevent SQL injection vulnerabilities by providing bound parameters and prepared statements:

```java
Query q = db.createQuery(
"UPDATE users SET pw_hash = @hash WHERE token = @token");
q.setParameter("hash", request.params["hash"]);
q.setParameter("token", request.params["token"]);
db.query(q);
```

However, merely establishing a guideline to use prepared statements does not result in a scalable security process. You would need to educate every developer about this rule, and security reviewers would have to review all application code to ensure consistent use of prepared statements. Instead, you can design the database API so that mixing user input and SQL becomes impossible by design. For example, you can create a separate type called TrustedSqlString and enforce by construction that all SQL query strings are created from developer-controlled input. In Go, you could implement the type as follows:

```go
struct Query {
sql strings.Builder;
}
type stringLiteral string;
// Only call this function with string literal parameters.
func (q *Query) AppendLiteral(literal stringLiteral) {
q.sql.writeString(literal);
}
// q.AppendLiteral("foo") will work, q.AppendLiteral(foo) will not
```

This implementation guarantees by construction that the contents of q.sql are entirely concatenated from string literals present in your source code, and the user cannot provide string literals. To enforce this contract at scale, you can use a language-specific mechanism to make sure AppendLiteral is called only with string literals. For example:

## In Go

Use a package-private type alias (stringLiteral). Code outside the package cannot refer to this alias; however, string literals are implicitly converted to this type.

## In Java

Use the Error Prone code checker, which provides a @CompileTimeConstant annotation for parameters.

## In C++

Use a template constructor that depends on each character value in the string.

You can find similar mechanisms for other languages.

You can’t build some features—like a data analytics application that by design runs arbitrary SQL queries provided by the user who owns the data—using just compile- time constants. To handle complicated use cases, at Google we allow a way to bypass the type restrictions with approval from a security engineer. For example, our database API has a separate package, unsafequery, that exports a distinct unsafe query.String type, which can be constructed from arbitrary strings and appended to SQL queries. Only a small fraction of our queries use the unchecked APIs. The burden of reviewing new uses of SQL queries that are not inherently safe and other restricted API patterns is handled by one (rotating) engineer on a part-time basis, for hundreds to thousands of active developers. See “Lessons for Evaluating and Building Frameworks” on page 256 for other benefits of reviewed exemptions.

## Preventing XSS: SafeHtml

The type-based safety approach we described in the previous section is not specific to SQL injection. Google uses a more complex version of the same design to reduce cross-site scripting vulnerabilities in web applications.3

At their core, XSS vulnerabilities occur when a web application renders untrustworthy input without appropriate sanitization. For example, an application might interpolate an attacker-controlled $address value into an HTML snippet such as <div> $address</div>, which is shown to another user. An attacker can then set $address to <script>exfiltrate_user_data();</script> and execute arbitrary code in the context of another user’s page.

HTML does not have the equivalent of binding query parameters. Instead, untrustworthy values must be appropriately sanitized or escaped before they are inserted into an HTML page. Furthermore, different HTML attributes and elements have different semantics, so application developers have to treat values differently depending on the context in which they appear. For example, an attacker-controlled URL can cause code execution with the javascript: scheme.

A type system can capture these requirements by introducing different types for values meant for different contexts—for example, SafeHtml to represent the contents of an HTML element, and SafeUrl for URLs that are safe to navigate to. Each of the types is a (immutable) wrapper around a string; the contracts are upheld by the constructors available for each type. The constructors make up the trusted codebase that’s responsible for ensuring the security properties of the application.

3 This system is described in more detail in Kern, Christoph. 2014. “Securing the Tangled Web.” Communications of the ACM 57(9): 38–47. https://oreil.ly/drZss.

Google has created different builder libraries for different use cases. Individual HTML elements can be constructed with builder methods that require the correct type for each attribute value, and SafeHtml for the element contents. The template system with strict contextual escaping guarantees the SafeHtml contract for more complicated HTML. That system does the following:

1. Parses the partial HTML in the template

2. Determines the context for each substitution point

3. Either requires the program to pass in a value of the correct type, or correctly escapes or sanitizes untrusted string values

For example, if you have the following Closure Template:

```html
{template .foo kind="html"}<script src="{$url}"></script>{/template}
```

trying to use a string value for $url will fail:

```java
templateRendered.setMapData(ImmutableMap.of("url", some_variable));
```

Instead, the developer has to provide a TrustedResourceUrl value, e.g.:

```java
templateRenderer.setMapData(
ImmutableMap.of("x", TrustedResourceUrl.fromConstant("/script.js"))
).render();
```

If HTML originates from an untrusted source, you won’t want to embed it into your application’s web UI, since doing so would result in an easily exploitable XSS vulnerability. Instead, you can use an HTML sanitizer that parses the HTML and performs runtime checks to determine that each value meets its contract. The sanitizer removes elements that do not meet their contract, or elements for which it is impossible to check the contract at runtime. You can also use a sanitizer to interoperate with other systems that don’t use safe types, because many HTML fragments are unchanged by sanitization.

Different HTML construction libraries target different developer productivity and code readability tradeoffs. However, they all enforce the same contract and should be equally trustworthy (apart from any bugs in their trusted implementations). In fact, to reduce the maintenance burden at Google, we code-generate the builder functions in various languages from a declarative configuration file. This file lists HTML elements and the required contracts for the values of each attribute. Some of our HTML sanitizers and template systems use the same configuration file.

A mature open source implementation of safe types for HTML is available in Closure Templates, and there is an effort underway to introduce type-based security as a web standard.
