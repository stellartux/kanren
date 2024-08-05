/** µKanren is an embedded DSL for relational logic programming. */

/** A `State` is a set of bindings from identifiers to values or variables. */
export type State = Readonly<Record<string, unknown>>;

/** A `Stream` is a `Generator` which yields `State`s. */
export type Stream = Generator<State, void>;

/** A `Goal` is a function which takes a `State` and returns a `Stream`. */
export type Goal = (state: State) => Stream;

/** A `GoalConstructor` takes a `State` and returns a `Goal`. */
export type GoalConstructor = (state: State) => Goal;

/**
 * When a goal succeeds, it yields a state with the bindings which allowed the
 * goal to succeed. A goal can yield several times if there are multiple
 * possible bindings which allow the goal to succeed.
 */
export const succeed: Goal = function* (s = emptyState) {
  yield s;
};

/** When a goal fails, it doesn't yield anything. */
export const fail: Goal = function* (_s) {};

/** A `Var` represents an unbound logic variable. */
export class Var {
  id;
  constructor(id: string = crypto.randomUUID()) {
    this.id = id;
  }
  toString() {
    return 'Var("' + this.id + '")';
  }
  static isVar(x: unknown): x is Var {
    return x instanceof Var;
  }
}

/** Find a variable's binding in the state. */
function walk(v: unknown, s: State): unknown {
  while (v instanceof Var) {
    const w = s[v.id];
    if (v === w) break;
    v = w;
  }
  return v;
}

/** Recursively walk a variable's binding in the state. */
function walkRec(v: unknown, s: State): unknown {
  v = walk(v, s);
  if (Array.isArray(v)) {
    return v.map((x) => walkRec(x, s));
  } else {
    return v;
  }
}

/** The `emptyState` has no bindings. */
const emptyState: State = Object.freeze({});

function extend(
  state: State | undefined,
  bindings: Record<string, unknown>,
): State {
  return Object.freeze(Object.assign({}, state, bindings));
}

/**
 * The `Goal` constructor `identical` declares two terms to be identical.
 * The goal succeeds if `u` and `v` can be unified in the state `s`.
 * This is written as `≡` in microKanren and as `=` in Prolog.
 */
export function identical(u: unknown, v: unknown): Goal {
  return function* (s = emptyState) {
    const t = unify(u, v, s);
    if (t) yield t;
  };
}

/** Create a new `State` with `u` and `v` unified, if they can be unified. */
function unify(
  u: unknown,
  v: unknown,
  s: State,
): State | undefined {
  u = walk(u, s);
  v = walk(v, s);
  if (u === v) {
    return s;
  } else if (u instanceof Var) {
    return extend(s, { [u.id]: v });
  } else if (v instanceof Var) {
    return extend(s, { [v.id]: u });
  } else if (Array.isArray(u) && Array.isArray(v)) {
    const length = u.length;
    if (length === v.length) {
      let t: State | undefined = s;
      for (let i = 0; i < length; ++i) {
        if (!(t = unify(u[i], v[i], t))) {
          return;
        }
      }
      return t;
    }
  }
}

/**
 * The `conj` (conjunction) of goals succeeds if all of the goals succeed for a
 * given state. This is the logical AND of `goals`, the `,` operator in Prolog.
 */
export function conj(...goals: Goal[]): Goal {
  if (goals.length === 0) {
    return succeed;
  } else if (goals.length === 1) {
    return goals[0];
  } else {
    const goal = goals.shift() as Goal;
    if (goal === succeed) {
      return conj(...goals);
    } else if (goal === fail) {
      return goal;
    } else {
      return function* (s = emptyState) {
        for (const s1 of goal(s)) {
          yield* conj(...goals)(s1);
        }
      };
    }
  }
}

/**
 * The `disj` (disjunction) of Goals succeeds if any of the goals succeed for a
 * given state. This is the logical OR of `goals`, the `;` operator in Prolog.
 */
export function disj(...goals: Goal[]): Goal {
  if (goals.length === 0) {
    return fail;
  } else if (goals.length === 1) {
    return goals[0];
  } else {
    return function* (s = emptyState) {
      for (const goal of goals) {
        yield* goal(s);
      }
    };
  }
}

/**
 * The `disji` (interleaved disjunction) of Goals succeeds when each of its
 * goals succeeds. `disji` fairly enumerates each of its goals.
 */
export function disji(...goals: Goal[]): Goal {
  if (goals.length === 0) {
    return fail;
  } else if (goals.length === 1) {
    return goals[0];
  } else {
    return function* (s = emptyState) {
      const iters = goals.map((goal) => goal(s));
      while (iters.length > 0) {
        for (let i = 0; i < iters.length;) {
          const { done, value } = iters[i].next();
          if (done) {
            iters.splice(i, 1);
          } else {
            yield value;
            ++i;
          }
        }
      }
    };
  }
}

/** Creates a new `Var` with the `id` and calls the `GoalConstructor`. */
export function callFresh(id: string, gc: GoalConstructor): Goal {
  return function (s) {
    s = extend(s, { [id]: new Var(id) });
    return gc(s)(s);
  };
}

/**
 * Creates fresh bindings for each identifier in state for `fn`. The identifiers
 * are parsed from the stringified `GoalConstructor`, if the `GoalConstructor`
 * was defined with an object pattern, otherwise the `ids` must be passed in as
 * the first parameter of `fresh`.
 */
export function fresh(gc: GoalConstructor): Goal;
export function fresh(ids: string[], gc: GoalConstructor): Goal;
export function fresh(
  ids: string[] | GoalConstructor,
  gc?: GoalConstructor,
): Goal {
  if (gc === undefined) {
    gc = ids as GoalConstructor;
    if (/^(function )?\({ /.test(gc.toString())) {
      ids = /^(?:function )?\({ (\S+(?:, \S+)*) }\)/
        .exec(gc.toString())?.[1]
        .split(", ") as string[];
      if (ids === undefined) {
        throw new Error(
          "Couldn't parse variable names from goal constructor " +
            gc.name,
        );
      }
    } else {
      return gc(emptyState);
    }
  }
  const vars: Record<string, Var> = {};
  for (const id of (ids as string[])) {
    vars[id] = new Var(id);
  }
  return function (s0) {
    const s: State = extend(s0, vars);
    return gc(s)(s);
  };
}

/** The interface function for running goals. */
export function run(count: number, goal: Goal, state?: State): Stream;
export function run(goal: Goal, state?: State): Stream;
export function run(
  count: number | Goal,
  goal?: Goal | State,
  state: State = emptyState,
): Stream {
  if (typeof count === "number" && typeof goal === "function") {
    goal = take(count, goal as Goal);
  } else if (typeof count === "function") {
    state = goal as State;
    goal = count as Goal;
  } else {
    throw new Error("Bad arguments to `run`");
  }
  return goal(state);
}

/** Check if `x` is equal to or occurs in `v`  */
function occursCheck(x: unknown, v: unknown, s: State): boolean {
  v = walk(v, s);
  if (v instanceof Var) {
    return x === v;
  } else if (Array.isArray(v)) {
    return v.some((w) => occursCheck(x, w, s));
  } else {
    return false;
  }
}

/** `unify` with `occursCheck` */
function unifyCheck(
  u: unknown,
  v: unknown,
  s: State,
): State | undefined {
  if (u === v || !occursCheck(u, v, s) && !occursCheck(v, u, s)) {
    return unify(u, v, s);
  }
}

/**
 * The `Goal` constructor `identicalCheck` declares two terms to be identical,
 * and each term deos not contain the other, if it is an array.
 * This is written as `≡` in miniKanren.
 */
export function identicalCheck(u: unknown, v: unknown): Goal {
  return function* (s = emptyState) {
    const t = unifyCheck(u, v, s);
    if (t) {
      yield t;
    }
  };
}

/** Delay evaluation of a function call. */
// deno-lint-ignore ban-types
export function delay(fn: Function, ...args: unknown[]): Goal {
  return function (t) {
    return fn(...args)(t);
  };
}

/** Take up to `count` `State`s from the `Goal`. */
export function take(count: number, goal: Goal): Goal {
  return function* (s) {
    const iter = goal(s);
    while (count > 0) {
      --count;
      const { done, value } = iter.next();
      if (done) break;
      yield value;
    }
  };
}

/**
 * Succeeds when each of its goals succeeds. Every succeeding state is yielded
 * before the next goal is attempted.
 */
export function conde(...goals: (Goal | Goal[])[]): Goal {
  const { length } = goals;
  if (length === 0) {
    return fail;
  } else if (length === 1) {
    return Array.isArray(goals[0]) ? conj(...goals[0]) : goals[0];
  } else {
    return function* (s = emptyState) {
      for (const goal of goals) {
        if (Array.isArray(goal)) {
          yield* conj(...goal)(s);
        } else {
          yield* goal(s);
        }
      }
    };
  }
}

/**
 * Succeeds when each of its goals succeeds. Successful states are yielded once
 * per goal until every goal is exhausted. This provides a fair enumaration of
 * the states.
 */
export function condi(...goals: (Goal | Goal[])[]): Goal {
  const { length } = goals;
  if (length === 0) {
    return fail;
  } else if (length === 1) {
    return Array.isArray(goals[0]) ? conj(...goals[0]) : goals[0];
  } else {
    return function* (s = emptyState) {
      const iters = goals.map((g) => Array.isArray(g) ? conj(...g)(s) : g(s));
      while (iters.length > 0) {
        for (let i = 0; i < iters.length;) {
          const { value, done } = iters[i].next();
          if (done) {
            iters.splice(i, 1);
          } else {
            yield value;
            ++i;
          }
        }
      }
    };
  }
}

/**
 * Succeeds
 */
export function conda(...goals: (Goal | Goal[])[]): Goal {
  const { length } = goals;
  if (length === 0) {
    return fail;
  } else if (length === 1) {
    return Array.isArray(goals[0]) ? conj(...goals[0]) : goals[0];
  } else {
    return function* (s = emptyState) {
      for (const goal of goals) {
        if (Array.isArray(goal)) {
          const iter = goal[0](s);
          const { value, done } = iter.next();
          if (!done) {
            const rest = conj(...goal.slice(1));
            yield* rest(value);
            for (const value of iter) {
              yield* rest(value);
            }
            break;
          }
        } else {
          const { value, done } = goal(s).next();
          if (!done) {
            yield value;
            break;
          }
        }
      }
    };
  }
}

export function condu(...goals: (Goal | Goal[])[]): Goal {
  if (goals.length === 0) {
    return fail;
  } else {
    return function* (s = emptyState) {
      for (const goal of goals) {
        if (Array.isArray(goal)) {
          if (goal.length === 0) continue;
          const { done, value } = (goal.shift() as Goal)(s).next();
          if (!done) {
            yield* conj(...goal)(value);
            break;
          }
        } else {
          const { done, value } = goal(s).next();
          if (!done) {
            yield value;
            break;
          }
        }
      }
    };
  }
}

/** Succeeding when the goals succeed in a random order. */
export function condr(...goals: (Goal | Goal[])[]): Goal {
  return function* (s) {
    const iters = goals.map((goal) =>
      Array.isArray(goal) ? conj(...goal)(s) : goal(s)
    );
    while (iters.length > 0) {
      const i = Math.floor(Math.random() * iters.length);
      const { done, value } = iters[i].next();
      if (done) {
        iters.splice(i, 1);
      } else {
        yield value;
      }
    }
  };
}

class InstantiationError extends Error {
  constructor(msg = "Instantiation Error") {
    super(msg);
  }
}

/** Succeeds when `el` is an element of `list`. */
export function membero(el: unknown, list: unknown): Goal {
  if (Var.isVar(list)) {
    return function* (s = emptyState) {
      // TODO ground list at runtime
      const l = walk(list, s);
      if (Var.isVar(l)) {
        for (const result of varList([el])) {
          yield extend(s, { [list.id]: result });
        }
      } else if (Array.isArray(l)) {
        yield* membero(el, l)(s);
      }
    };
  } else if (Array.isArray(list)) {
    return function* (s = emptyState) {
      for (const x of list) {
        const t = unify(el, x, s);
        if (t) yield t;
      }
    };
  } else {
    return fail;
  }
}

function isInteger(x: unknown): x is number | bigint {
  return typeof x === "number" ? Number.isInteger(x) : typeof x === "bigint";
}

export function between(start: unknown, stop: unknown, value: unknown): Goal {
  function betweenGGG(
    start: number | bigint,
    stop: number | bigint,
    value: number | bigint,
  ): Goal {
    return start <= value && value <= stop ? succeed : fail;
  }
  function betweenGGV(
    start: number | bigint,
    stop: number | bigint,
    value: Var,
  ): Goal {
    return function* (s) {
      for (let i = start; i <= stop; i++) {
        const t = unify(value, i, s);
        if (t) yield t;
      }
    };
  }

  if (isInteger(start) && (isInteger(stop) || stop === Infinity)) {
    if (isInteger(value)) {
      return betweenGGG(start, stop, value);
    } else if (value instanceof Var) {
      return function (s) {
        const x = walk(value, s);
        if (isInteger(x)) {
          return betweenGGG(start, stop, x)(s);
        } else if (Var.isVar(x)) {
          return betweenGGV(start, stop, x)(s);
        } else {
          throw new InstantiationError("Expected a number, bigint or Var");
        }
      };
    } else {
      return fail;
    }
  } else {
    return function (s) {
      const start1 = walk(start, s);
      const stop1 = walk(stop, s);
      if (!isInteger(start1)) {
        throw new InstantiationError("start should be an integer or bigint");
      } else if (!isInteger(stop1) && stop1 !== Infinity) {
        throw new InstantiationError(
          "stop should be an integer, bigint or Infinity",
        );
      }
      return between(start1, stop1, walk(value, s))(s);
    };
  }
}

function* varList(result: unknown[] = []): Generator<unknown[]> {
  while (true) {
    yield result;
    result.push(new Var());
  }
}

/** Succeeds when `x` is a list. */
export function listo(x: unknown): Goal {
  if (Var.isVar(x)) {
    return function* (s) {
      const v = walk(x, s);
      if (Var.isVar(v)) {
        for (const vars of varList()) {
          yield extend(s, { [v.id]: vars });
        }
      } else if (Array.isArray(v)) {
        yield s;
      }
    };
  } else if (Array.isArray(x)) {
    return succeed;
  } else {
    return fail;
  }
}

/** Succeeds when the `list` has `length` elements. */
export function lengtho(list: unknown, length: unknown): Goal {
  if (Array.isArray(list)) {
    if (typeof length === "number") {
      return list.length === length ? succeed : fail;
    } else if (Var.isVar(length)) {
      return identical(length, list.length);
    }
  } else if (Var.isVar(list)) {
    if (typeof length === "number" || typeof length === "bigint") {
      return identical(
        list,
        Array.from({ length: Number(length) }, () => new Var()),
      );
    } else if (Var.isVar(length)) {
      return function* (s) {
        const li = walk(list, s);
        const le = walk(length, s);
        if (Var.isVar(li) && Var.isVar(le)) {
          let len = 0n;
          for (const t of listo(list)(s)) {
            yield extend(t, { [le.id]: len });
            len++;
          }
        } else {
          yield* lengtho(list, length)(s);
        }
      };
    }
  }
  throw new InstantiationError(); // TODO msg
}

/** Succeeds when `list` is the concatenation of `prefix` and `suffix`. */
export function appendo(prefix: unknown, suffix: unknown, list: unknown): Goal {
  if (Array.isArray(prefix)) {
    if (Array.isArray(suffix)) {
      return identical([...prefix, ...suffix], list);
    } else if (Var.isVar(suffix)) {
      if (Array.isArray(list)) {
        return conj(
          identical(list.slice(0, prefix.length), prefix),
          identical(list.slice(prefix.length), suffix),
        );
      } else if (Var.isVar(list)) {
        return function* (s) {
          for (const vars of varList()) {
            yield* conj(
              identical(suffix, vars),
              identical(list, [...prefix, ...vars]),
            )(s);
          }
        };
      }
    }
  } else if (Var.isVar(prefix)) {
    if (Array.isArray(suffix)) {
      if (Array.isArray(list)) {
        const start = list.length - suffix.length;
        if (start < 0) {
          return fail;
        } else {
          return function* (s = {}) {
            for (let i = 0; i < suffix.length; ++i) {
              //@ts-ignore .
              s = identical(list[start + i], suffix[i])(s).next().value;
              if (!s) return;
            }
            yield* identical(prefix, list.slice(0, start))(s);
          };
        }
      } else if (list instanceof Var) {
        return function* (s) {
          for (const t of listo(prefix)(s)) {
            yield* identical(list, [...(t[prefix.id] as unknown[]), ...suffix])(
              t,
            );
          }
        };
      }
    } else if (Var.isVar(suffix)) {
      if (Array.isArray(list)) {
        return function* (s) {
          for (let i = 0; i <= list.length; ++i) {
            yield Object.freeze(Object.assign({}, s, {
              [prefix.id]: list.slice(0, i),
              [suffix.id]: list.slice(i),
            }));
          }
        };
      } else if (Var.isVar(list)) {
        return function* (s) {
          for (const t of listo(prefix)(s)) {
            yield Object.freeze(Object.assign({}, t, {
              [suffix.id]: [],
              [list.id]: prefix,
            }));
          }
        };
      }
    }
  }
  return fail;
}

/** Succeeds when `v` is the successor of `u`. */
export function succo(u: unknown, v: unknown): Goal {
  if (Number.isInteger(u)) {
    if (Number.isInteger(v)) {
      return (v as number) - (u as number) === 1 ? succeed : fail;
    } else if (typeof v === "bigint") {
      return v - BigInt(u as number) === 1n ? succeed : fail;
    } else if (Var.isVar(v)) {
      return identical(v, u as number + 1);
    }
  } else if (typeof u === "bigint") {
    if (Number.isInteger(v)) {
      return BigInt(v as number) - u === 1n ? succeed : fail;
    } else if (typeof v === "bigint") {
      return v - u === 1n ? succeed : fail;
    } else if (Var.isVar(v)) {
      return identical(v, u + 1n);
    }
  } else if (Var.isVar(u)) {
    if (Number.isInteger(v)) {
      return identical(u, (v as number) - 1);
    } else if (typeof v === "bigint") {
      return identical(u, v - 1n);
    }
  }
  throw new InstantiationError();
}

/** Succeeds when `c` is the sum of `a` and `b`. */
export function pluso(a: unknown, b: unknown, c: unknown): Goal {
  if (typeof a === "number" || typeof a === "bigint") {
    if (typeof b === "number" || typeof b === "bigint") {
      if (typeof c === "number" || typeof c === "bigint") {
        return BigInt(a) + BigInt(b) === BigInt(c) ? succeed : fail;
      } else if (Var.isVar(c)) {
        return identical(c, BigInt(a) + BigInt(b));
      }
    } else if (
      Var.isVar(b) && (typeof c === "number" || typeof c === "bigint")
    ) {
      return identical(b, BigInt(c) - BigInt(a));
    }
  } else if (
    Var.isVar(a) && (typeof b === "number" || typeof b === "bigint") &&
    (typeof c === "number" || typeof c === "bigint")
  ) {
    return identical(a, BigInt(c) - BigInt(b));
  }
  throw new InstantiationError();
}

/** Succeeds when `u` is a number. */
export function numbero(u: unknown): Goal {
  if (Var.isVar(u)) {
    return function* (s) {
      const v = walk(u, s);
      if (typeof v === "number" || typeof v === "bigint") {
        yield s;
      }
    };
  } else if (typeof u === "number" || typeof u === "bigint") {
    return succeed;
  } else {
    return fail;
  }
}

/** Succeeds when `u` unifies with the first value in `v`. */
export function firsto(u: unknown, v: unknown): Goal {
  if (Var.isVar(v)) {
    return function* (s) {
      for (const vars of varList([u])) {
        yield* identical(v, vars)(s);
      }
    };
  } else if (Array.isArray(v) && v.length > 0) {
    return identical(u, v[0]);
  } else {
    return fail;
  }
}

/** Succeeds when `u` unifies with the last value in `v`. */
export function lasto(u: unknown, v: unknown): Goal {
  if (Var.isVar(v)) {
    return function* (s) {
      for (const vars of varList()) {
        yield* identical(v, [...vars, u])(s);
      }
    };
  } else if (Array.isArray(v) && v.length > 0) {
    return identical(u, v.at(-1));
  } else {
    return fail;
  }
}

/** Succeeds when `el` is the `n`th element of the `list`. `n` is 0-based. */
export function ntho(n: unknown, list: unknown, el: unknown): Goal {
  if (Number.isInteger(n) || typeof n === "bigint") {
    if (Array.isArray(list)) {
      if (Var.isVar(el)) {
        if ((n as number) >= 0 && (n as number) < list.length) {
          return identical(el, list[Number(n)]);
        }
      } else if (el === list[n as number]) {
        return succeed;
      }
      return fail;
    } else if (Var.isVar(list)) {
      return function* (s) {
        const result: unknown[] = Array.from(
          { length: n as number },
          () => new Var(),
        );
        result.push(el);
        for (const vars of varList(result)) {
          yield* identical(list, vars)(s);
        }
      };
    }
  } else if (Var.isVar(n)) {
    if (Array.isArray(list)) {
      if (Var.isVar(el)) {
        return function* (s) {
          for (let i = 0; i < list.length; ++i) {
            yield* conj(
              identical(n, i),
              identical(el, list[i]),
            )(s);
          }
        };
      } else {
        return function* (s) {
          for (let i = 0; i < list.length; ++i) {
            if (list[i] === el) {
              yield extend(s, { [n.id]: i });
            }
          }
        };
      }
    } else if (Var.isVar(list)) {
      return function* (s) {
        // todo, ground vars
        for (const tail of varList([el])) {
          for (const head of varList()) {
            yield extend(s, {
              [list.id]: [...head, ...tail],
              [n.id]: head.length + tail.length,
            });
          }
        }
      };
    }
  }
  throw new InstantiationError("ntho");
}

/** Turn a boolean predicate into Goal constructor. */
export function filter(pred: (x: unknown) => boolean): (x: unknown) => Goal {
  return function (x) {
    if (Var.isVar(x)) {
      return function* (s) {
        if (pred(x)) yield s;
      };
    } else if (pred(x)) {
      return succeed;
    } else {
      return fail;
    }
  };
}

/** True if x is not a variable and contains no variables. */
function isGround(x: unknown): boolean {
  return Array.isArray(x) ? x.every(isGround) : !Var.isVar(x);
}

/** Succeeds when `x` is ground. */
export const groundo = filter(isGround);

/** Relates a string to a list of chars. */
export function stringChars(str: unknown, cs: unknown): Goal {
  if (Array.isArray(cs)) {
    if (typeof str === "string") {
      return str === cs.join("") ? succeed : fail;
    } else if (Var.isVar(str)) {
      if (cs.some(Var.isVar)) {
        return function* (s) {
          yield* identical(str, walkRec(cs, s))(s);
        };
      } else {
        return identical(str, cs.join(""));
      }
    }
  } else if (Var.isVar(cs)) {
    if (typeof str === "string") {
      return identical(cs, str.split(""));
    } else if (Var.isVar(str)) {
      return function* (s) {
        const strGround = walkRec(str, s);
        const csGround = walkRec(cs, s);
        if (
          isGround(strGround) && typeof strGround === "string" ||
          isGround(csGround) && Array.isArray(csGround)
        ) {
          yield* stringChars(str, cs)(s);
        } else {
          throw new InstantiationError("stringChars");
        }
      };
    }
  }
  throw new InstantiationError("stringChars");
}

export function numberChars(n: unknown, cs: unknown): Goal {
  if (typeof n === "number") {
    if (isGround(cs) && Array.isArray(cs)) {
      return n.toString() === cs.join("") ? succeed : fail;
    } else if (Var.isVar(cs) || Array.isArray(cs)) {
      return identical(n.toString().split(""), cs);
    }
  } else if (Var.isVar(n)) {
    if (isGround(cs)) {
      if (Array.isArray(cs)) {
        return identical(n, Number(cs.join("")));
      } else {
        return fail;
      }
    } else {
      return function* (s) {
        const d = walkRec(cs, s);
        const x = walk(n, s);
        if (Var.isVar(x) && !isGround(d)) {
          throw new InstantiationError("numberChars");
        }
        yield* numberChars(d, x)(s);
      };
    }
  }
  throw new InstantiationError("numberChars");
}

/** Succeeds when `car` is the first element of `list` and `cdr` is the rest of the list. */
export function conso(car: unknown, cdr: unknown, list: unknown): Goal {
  if (Array.isArray(cdr)) {
    return identical([car, ...cdr], list);
  } else if (Var.isVar(cdr)) {
    return function (s) {
      const d = walk(cdr, s);
      const l = walk(list, s);
      if (Var.isVar(d) && Array.isArray(l)) {
        return conj(
          identical(car, l[0]),
          identical(d, l.slice(1)),
        )(s);
      } else if (Var.isVar(l) && Array.isArray(d)) {
        return identical(l, [car, ...d])(s);
      } else {
        throw new InstantiationError("conso");
      }
    };
  }
  throw new InstantiationError("conso");
}
