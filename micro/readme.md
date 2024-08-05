# µKanren

[µKanren] is a minimal logic language designed to be ported to many different
languages to add nondeterminism, relations and logic variables to languages
which don't natively support them. It was first described in
[microKanren: A Minimal Functional Core for Relational Programming].

## Introduction to microKanren

### A Quick Primer

If you're already familiar with logic programming, µKanren can be thought of as
an implementation of logic variables, unification, conjunction and disjunction.
With these primitives and the features of the host language, the rest of the
relational paradigm can be built.

|                         | Prolog  | Scheme                     | JavaScript
| ----------------------- | ------- | -------------------------- | ----------
| Create a fresh variable | `X`     | `(call/fresh (λ (x) ...))` | `callFresh('x', ({ x }) => ...)`
| Unification             | `X = Y` | `(== x y)`                 | `identical(x, y)`
| Logical conjunction     | `X, Y`  | `(conj x y)`               | `conj(x, y)`
| Logical disjunction     | `X ; Y` | `(disj x y)`               | `disj(x, y)`
| Success                 | `true`  | `succeed`                  | `succeed`
| Failure                 | `fail`  | `fail`                     | `fail`
| Delay a computation     | N/A     | `(delay f)`                | `delay(f)`

A simple Prolog predicate:

```prolog
f(X, Y) :-
    X = 1,
    (   Y = 2
    ;   Y = 3
    ).

?- f(X, Y).
X = 1,
Y = 2 ;
X = 1,
Y = 3.
```

Translates to the original Scheme microKanren as:

```scheme
(define f
  (call/fresh (λ (x)
    (call/fresh (λ (y)
      (conj
        (== x 1)
        (disj
          (== y 2)
          (== y 3))))))))

(call/empty-state f)
;=> ((((#(1) . 2) (#(0) . 1)) . 2) (((#(1) . 3) (#(0) . 1)) . 2))
```

And translates to this JavaScript microKanren as:

```js
const f =
  callFresh('x', ({ x }) =>
    callFresh('y', ({ y }) =>
      conj(
        identical(x, 1),
        disj(
          identical(y, 2),
          identical(y, 3)))))

for (const { x, y } of f()) console.log(`X = ${x}, Y = ${y}`)
// X = 1, Y = 2
// X = 1, Y = 3
```

The `delay` function is used to delay evaluation of recursive relations.
The following Scheme example from [microKanren: A Minimal Functional Core for Relational Programming] can be translated to JavaScript.

```scheme
(define (fives x)
  (disj
    (== x 5)
    (λ (s/c) (λ () ((fives x) s/c)))))
```

```js
const fives =
  callFresh('x', (state) =>
    disj(
      identical(state.x, 5),
      delay(fives, state)))
```

[µKanren]: https://github.com/jasonhemann/microKanren
[microKanren: A Minimal Functional Core for Relational Programming]: http://webyrd.net/scheme-2013/papers/HemannMuKanren2013.pdf
