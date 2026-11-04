# Precise names — source extract

Verbatim extract from *A Philosophy of Software Design* by John Ousterhout
(Yaknyam Press), Chapter 14, "Choosing Names", the part on precision. Only
PDF line breaks were joined and code was fenced; the wording is unchanged.
"The block bug above" refers to an earlier example in the chapter that is not
part of this extract.

---

Good names have two properties: precision and consistency. Let’s start with precision. The most common problem with names is that they are too generic or vague; as a result, it’s hard for readers to tell what the name refers to; the reader may assume that the name refers to something different from reality, as in the block bug above. Consider the following method declaration:

```cpp
/**
* Returns the total number of indexlets this object is managing.
*/
int IndexletManager::getCount() {...}
```

The term “count” is too generic: count of what? If someone sees an invocation of this method, they are unlikely to know what it does unless they read its documentation. A more precise name like getActiveIndexlets or numIndexlets would be better: with one of these names, readers will probably be able to guess what the method returns without having to look at its documentation.

Here are some other examples of names that aren’t precise enough, taken from various student projects:

A project building a GUI text editor used the names x and y to refer to the position of a character in the file. These names are too generic. They could mean many things; for example, they might also represent the coordinates (in pixels) of a character on the screen. Someone seeing the name x in isolation is unlikely to think that it refers to the position of a character within a line of text. The code would be clearer if it used names such as charIndex and lineIndex, which reflect the specific abstractions that the code implements.

Another editor project contained the following code:

```java
// Blink state: true when cursor visible.
private boolean blinkStatus = true;
```

The name blinkStatus doesn’t convey enough information. The word “status” is too vague for a boolean value: it gives no clue about what a true or false value means. The word “blink” is also vague, since it doesn’t indicate what is blinking. The following alternative is better:

```java
// Controls cursor blinking: true means the cursor is visible,
// false means the cursor is not displayed.
private boolean cursorVisible = true;
```

The name cursorVisible conveys more information; for example, it allows readers to guess what a true value means (as a general rule, names of boolean variables should always be predicates). The word “blink” is no longer in the name, so readers will have to consult the documentation if they want to know why the cursor isn’t always visible; this information is less important.

A project implementing a consensus protocol contained the following code:

```java
// Value representing that the server has not voted (yet) for
// anyone for the current election term.
private static final String VOTED_FOR_SENTINEL_VALUE = "null";
```

The name for this value indicates that it’s special but it doesn’t say what the special meaning is. A more specific name such as NOT_YET_VOTED would be better.

A variable named result was used in a method with no return value. This name has multiple problems. First, it creates the misleading impression that it will be the return value of the method. Second, it provides essentially no information about what it actually holds, except that it is some computed value. The name should provide information about what the result actually is, such as mergedLine or totalChars. In methods that do actually have return values, then using the name result is reasonable. This name is still a bit generic, but readers can look at the method documentation to see its meaning, and it’s helpful to know that the value will eventually become the return value.

> **Red Flag: Vague Name**
>
> If a variable or method name is broad enough to refer to many different things, then it doesn’t convey much information to the developer and the underlying entity is more likely to be misused.

Like all rules, the rule about choosing precise names has a few exceptions. For example, it’s fine to use generic names like i and j as loop iteration variables, as long as the loops only span a few lines of code. If you can see the entire range of usage of a variable, then the meaning of the variable will probably be obvious from the code so you don’t need a long name. For example, consider the following code:

```c
for (i = 0; i < numLines; i++) {
...
}
```

It’s clear from this code that i is being used to iterate over each of the lines in some entity. If the loop gets so long that you can’t see it all at once, or if the meaning of the iteration variable is harder to figure out from the code, then a more descriptive name is in order.

It’s also possible for a name to be too specific, such as in this declaration for a method that deletes a range of text:

```java
void delete(Range selection) {...}
```

The argument name selection is too specific, since it suggests that the text being deleted is always selected in the user interface. However, this method can be invoked on any range of text, selected or not. Thus, the argument name should be more generic, such as range.

If you find it difficult to come up with a name for a particular variable that is precise, intuitive, and not too long, this is a red flag. It suggests that the variable may not have a clear definition or purpose. When this happens, consider alternative factorings. For example, perhaps you are trying to use a single variable to represent several things; if so, separating the representation into multiple variables may result in a simpler definition for each variable. The process of choosing good names can improve your design by identifying weaknesses.

> **Red Flag: Hard to Pick Name**
>
> If it’s hard to find a simple name for a variable or method that creates a clear image of the underlying object, that’s a hint that the underlying object may not have a clean design.
