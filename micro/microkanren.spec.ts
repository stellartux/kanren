#!/usr/bin/env -s deno test

import { assertEquals } from "jsr:@std/assert";

import {
  callFresh,
  conj,
  delay,
  disj,
  fail,
  identical,
  succeed,
} from "./microkanren.js";
import { Goal, GoalConstructor, State, Stream } from "./microkanren.d.ts";

function assertFails(goal: Goal) {
  assertEquals(goal().next().done, true, goal.toString());
}
function assertSucceeds(goal: Goal) {
  assertEquals(goal().next().done, false, goal.toString());
}
function assertSucceedsNTimes(n: number, goal: Goal) {
  const iter = goal();
  for (let i = 0; i < n; ++i) {
    assertEquals(iter.next().done, false);
  }
  assertEquals(iter.next().done, true);
}
function assertRun(goal: Goal, expected: Iterable<State>, infinite = false) {
  const iter = goal();
  for (const expectedValue of expected) {
    const { done, value } = iter.next();
    assertEquals(value, expectedValue);
    if (done) break;
  }
  if (!infinite) assertEquals(iter.next().done, true);
}

Deno.test("fail", () => assertFails(fail));

Deno.test("succeed", () => assertSucceeds(succeed));

Deno.test("conj", () => {
  assertSucceeds(conj());
  assertSucceeds(conj(succeed));
  assertSucceeds(conj(identical(3, 3), succeed));
  assertFails(conj(fail));
  assertFails(conj(succeed, succeed, fail));
  assertSucceeds(conj(succeed, succeed, succeed, succeed));
});

Deno.test("disj", () => {
  assertFails(disj());
  assertSucceeds(disj(succeed));
  assertFails(disj(fail, fail));
  assertSucceedsNTimes(2, disj(succeed, succeed));
  assertSucceedsNTimes(2, disj(fail, succeed, fail, succeed, fail));
});

Deno.test("fresh, identical", () => {
  assertRun(callFresh("x", (s: State) => identical(s.x, 3)), [{ x: 3 }]);
});

Deno.test("fresh 2", () => {
  assertRun(
    callFresh(
      "x",
      () =>
        callFresh(
          "y",
          ({ x, y }: State) => conj(identical(x, 3), identical(y, 4)),
        ),
    ),
    [{ x: 3, y: 4 }],
  );
});

Deno.test("fresh 3", () => {
  assertRun(
    callFresh("x", (s: State) => disj(identical(s.x, 3), identical(s.x, 4))),
    [{ x: 3 }, { x: 4 }],
  );
});

const aAndB: GoalConstructor = ({ a, b } = {}) =>
  conj(
    identical(a, 7),
    disj(
      identical(b, 5),
      identical(b, 6),
    ),
  );

Deno.test("a and b", () => {
  assertRun(callFresh("a", () => callFresh("b", aAndB)), [
    { a: 7, b: 5 },
    { a: 7, b: 6 },
  ]);
});

const fives: GoalConstructor = (s = {}) =>
  disj(identical(s.x, 5), delay(fives, s));

Deno.test("fives", () => {
  assertRun(callFresh("x", fives), [
    { x: 5 },
    { x: 5 },
    { x: 5 },
    { x: 5 },
  ], true);
});

const sixes: GoalConstructor = (s = {}) =>
  function* loop(t): Stream {
    yield* identical(s.x, 6)(t);
    yield* loop(t);
  };

Deno.test("sixes", () => {
  assertRun(callFresh("x", sixes), [
    { x: 6 },
    { x: 6 },
    { x: 6 },
    { x: 6 },
  ], true);
});

Deno.test("identical lists", () => {
  assertSucceeds(identical(["x", "y", "z"], ["x", "y", "z"]));
  assertRun(
    callFresh("z", () =>
      callFresh(
        "x",
        ({ x, z }: State) => identical(["x", "y", z], [x, "y", "z"]),
      )),
    [{ x: "x", z: "z" }],
  );
  assertFails(identical(["x", "y", "z"], ["x", "y", "not z"]));
  assertFails(identical(["x", "y", "z"], ["x", "y", "z", "a"]));
  assertFails(identical(["x", "y", "z", "a"], ["x", "y", "z"]));
  assertFails(identical("xyz", ["x", "y", "z"]));
});
