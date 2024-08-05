#!/usr/bin/env -s deno test

import {
  assert,
  assertEquals,
  assertFalse,
  // assertThrows,
} from "jsr:@std/assert";
const { test } = Deno;

import {
  appendo,
  between,
  callFresh,
  conda,
  conde,
  condi,
  condu,
  conj,
  conso,
  delay,
  disj,
  disji,
  fail,
  firsto,
  fresh,
  Goal,
  GoalConstructor,
  identical,
  identicalCheck,
  lasto,
  lengtho,
  listo,
  membero,
  ntho,
  numberChars,
  numbero,
  pluso,
  run,
  State,
  stringChars,
  succeed,
  succo,
  take,
  Var,
} from "./minikanren.ts";

function assertFails(goal: Goal) {
  assert(run(goal).next().done);
}
function assertSucceeds(goal: Goal) {
  assertFalse(run(goal).next().done);
}
function assertSucceedsNTimes(n: number, goal: Goal) {
  const iter = run(goal);
  for (let i = 0; i < n; ++i) {
    assertFalse(iter.next().done);
  }
  assert(iter.next().done);
}
function assertRun(goal: Goal, expected: Iterable<State>, infinite = false) {
  const iter = run(goal);
  for (const expectedValue of expected) {
    const { done, value } = iter.next();
    assertEquals(value, expectedValue, `${value} === ${expectedValue}`);
    if (done) break;
  }
  if (!infinite) {
    assert(iter.next().done, "Expected end of stream.");
  }
}
function assertIsVar(x: unknown, msg?: string): Var {
  assert(Var.isVar(x), msg);
  return x;
}

test("fail", () => assertFails(fail));

test("succeed", () => assertSucceeds(succeed));

test("conj", () => assertSucceeds(conj(succeed, succeed, succeed, succeed)));

test("disj", () => assertSucceedsNTimes(2, disj(succeed, succeed)));

test("fresh, identical", () =>
  assertRun(fresh(({ x }) => identical(x, 3)), [{ x: 3 }]));

test("fresh 2", () => {
  assertRun(
    fresh(({ x, y }) => conj(identical(x, 3), identical(y, 4))),
    [{ x: 3, y: 4 }],
  );
});

test("fresh 3", () => {
  assertRun(
    fresh(({ x }) => disj(identical(x, 3), identical(x, 4))),
    [{ x: 3 }, { x: 4 }],
  );
});

const aAndB: GoalConstructor = ({ a, b }) =>
  conj(
    identical(a, 7),
    disj(
      identical(b, 5),
      identical(b, 6),
    ),
  );

test("a and b", () =>
  assertRun(fresh(aAndB), [{ a: 7, b: 5 }, { a: 7, b: 6 }]));

const fives: GoalConstructor = (s) => disj(identical(s.x, 5), delay(fives, s));

test("fives", () => {
  assertRun(fresh(["x"], fives), [
    { x: 5 },
    { x: 5 },
    { x: 5 },
    { x: 5 },
  ], true);
});

const sixes: GoalConstructor = (s) =>
  function* (s1) {
    yield* identical(s.x, 6)(s1);
    yield* sixes(s)(s1);
  };

test("sixes", () => {
  assertRun(fresh(({ x }) => take(4, sixes({ x }))), [
    { x: 6 },
    { x: 6 },
    { x: 6 },
    { x: 6 },
  ]);
});

const fivesAndSixesE: GoalConstructor = (s) => disj(fives(s), sixes(s));

test("fives & sixes, unfair", () => {
  assertRun(callFresh("x", fivesAndSixesE), [
    { x: 5 },
    { x: 5 },
    { x: 5 },
    { x: 5 },
    { x: 5 },
    { x: 5 },
  ], true);
});

const fivesAndSixesI: GoalConstructor = (s) => disji(fives(s), sixes(s));

test("fives & sixes, fair", () => {
  assertRun(callFresh("x", fivesAndSixesI), [
    { x: 5 },
    { x: 6 },
    { x: 5 },
    { x: 6 },
    { x: 5 },
    { x: 6 },
  ], true);
});

test("disji, streams with unequal lengths", () => {
  assertRun(
    callFresh("x", ({ x }) =>
      disji(
        disj(
          identical(x, 1),
          identical(x, 4),
          identical(x, 6),
        ),
        identical(x, 2),
        disj(
          identical(x, 3),
          identical(x, 5),
          identical(x, 7),
          identical(x, 8),
        ),
      )),
    [
      { x: 1 },
      { x: 2 },
      { x: 3 },
      { x: 4 },
      { x: 5 },
      { x: 6 },
      { x: 7 },
      { x: 8 },
    ],
  );
});

test("identicalCheck(-, +/-)", () => {
  assertSucceeds(fresh(({ x }) => identicalCheck(x, x)));
  assertSucceeds(fresh(({ x }) => identicalCheck(x, [1])));
  assertFails(fresh(({ x }) => identicalCheck(x, [x])));
});

test("membero(-, +)", () => {
  assertRun(fresh(({ x }) => membero(x, [1, 2, 3, 4])), [
    { x: 1 },
    { x: 2 },
    { x: 3 },
    { x: 4 },
  ]);
});
test("membero(+, -)", () => {
  assertRun(fresh(({ x }) => membero(1, [1, 2, x, 4])), [
    { x: new Var("x") },
    { x: 1 },
  ]);
});

test("conde", () => {
  assertRun(
    fresh(({ x }) =>
      conde(
        identical("olive", x),
        identical("oil", x),
        fail,
      )
    ),
    [{ x: "olive" }, { x: "oil" }],
  );
});

test("conde 2", () => {
  assertRun(
    fresh(({ x }) =>
      conde(
        [identical("virgin", x), fail],
        [identical("olive", x), succeed],
        [succeed, succeed],
        [identical("oil", x), succeed],
        [succeed, fail],
      )
    ),
    [{ x: "olive" }, { x: new Var("x") }, { x: "oil" }],
  );
});

function teacupo(x: unknown): Goal {
  return conde(
    identical("tea", x),
    identical("cup", x),
    fail,
  );
}

test("teacupo", () =>
  assertRun(fresh(({ x }) => teacupo(x)), [{ x: "tea" }, { x: "cup" }]));

test("condi", () => {
  assertRun(
    fresh(({ r }) =>
      condi(
        teacupo(r),
        identical(false, r),
      )
    ),
    [
      { r: "tea" },
      { r: false },
      { r: "cup" },
    ],
  );
});

test("conda", () => {
  assertFails(fresh(({ x }) =>
    conda(
      [identical("virgin", x), fail],
      [identical("olive", x), succeed],
      [identical("oil", x), succeed],
      [succeed, fail],
    )
  ));
});

test("condu", () =>
  assertRun(callFresh("x", ({ x }) => condu(teacupo(x))), [{ x: "tea" }]));

test("between(+, +, +/-)", () => {
  assertRun(callFresh("x", ({ x }) => between(1, 3, x)), [
    { x: 1 },
    { x: 2 },
    { x: 3 },
  ]);
  assertRun(callFresh("x", ({ x }) => between(1, Infinity, x)), [
    { x: 1 },
    { x: 2 },
    { x: 3 },
  ], true);
  assertSucceeds(between(1, 3, 2));
  assertSucceeds(between(1n, 3n, 2n));
  assertFails(between(1, 4, 5));
  assertFails(between(1n, 4n, 5n));
  assertSucceeds(fresh(({ n, x }) => conj(identical(n, 1), between(n, 3, x))));
});

test("listo(+/-)", () => {
  assertSucceeds(listo([]));
  assertSucceeds(listo([1, 2, 3]));
  assertFails(listo(3));
  assertFails(listo(undefined));
  const iter = callFresh("list", ({ list }) => listo(list))({});
  for (let i = 0; i < 10; ++i) {
    const list = iter.next().value?.list;
    assert(Array.isArray(list));
    assertEquals(list.length, i);
    assert(list.every(Var.isVar));
  }
});

test("lengtho(+, +)", () => {
  assertSucceeds(lengtho([1, 2, 3], 3));
  assertFails(lengtho([1, 2, 3], 4));
});
test("lengtho(+, -)", () => {
  assertRun(
    callFresh("length", ({ length }) => lengtho([1, 2, 3], length)),
    [{ length: 3 }],
  );
  const list = callFresh("list", ({ list }) => lengtho(list, 3))({}).next()
    .value?.list;
  assert(Array.isArray(list));
  assertEquals(list.length, 3);
  list.forEach((x) => assertIsVar(x));
});
test("lengtho(-, -)", () => {
  const gen = fresh(({ list, length }) => lengtho(list, length))({});
  for (let i = 0n; i < 10n; ++i) {
    const { done, value } = gen.next();
    assertFalse(done);
    const { length, list } = value;
    assertEquals(length, i, "Length value should be " + i);
    assert(Array.isArray(list), "Should be an array");
    assertEquals(BigInt(list.length), i, "List should be the length " + i);
    assert(list.every(Var.isVar), "Every element of list should be a variable");
  }
});

test("appendo(+, +, +)", () => {
  assertSucceeds(appendo([1, 2], [3, 4], [1, 2, 3, 4]));
});
test("appendo(+, +, -)", () => {
  assertRun(
    callFresh("x", ({ x }) => appendo([1, 2], [3, 4], x)),
    [{ x: [1, 2, 3, 4] }],
  );
});
test("appendo(+, -, +)", () => {
  assertRun(
    callFresh("x", ({ x }) => appendo([1, 2], x, [1, 2, 3, 4])),
    [{ x: [3, 4] }],
  );
});
test("appendo(-, +, +)", () => {
  assertRun(
    callFresh("x", ({ x }) => appendo(x, [3, 4], [1, 2, 3, 4])),
    [{ x: [1, 2] }],
  );
});
test("appendo(-, -, +)", () => {
  assertRun(
    fresh(({ x, y }) => appendo(x, y, [1, 2, 3, 4])),
    [
      { x: [], y: [1, 2, 3, 4] },
      { x: [1], y: [2, 3, 4] },
      { x: [1, 2], y: [3, 4] },
      { x: [1, 2, 3], y: [4] },
      { x: [1, 2, 3, 4], y: [] },
    ],
  );
});
test("appendo(+, -, -)", () => {
  assertRun(
    fresh(({ y, z }) => appendo([1, 2], y, z)),
    [{ y: [], z: [1, 2] }],
    true,
  );
});
test("appendo(-, -, -)", () => {
  const iter = fresh(({ prefix, suffix, list }) =>
    appendo(prefix, suffix, list)
  )({});
  for (let i = 0; i < 10; ++i) {
    const { prefix, suffix, list } = iter.next().value as State;
    assertEquals((prefix as Var[]).length, i);
    assertEquals(suffix, []);
    assertEquals(list, new Var("prefix"));
  }
});

test("succo(+, +)", () => {
  assertSucceeds(succo(2, 3));
  assertFails(succo(1, 0));
  assertSucceeds(succo(2n, 3n));
  assertFails(succo(1n, 0n));
});
test("succo(+, -)", () => {
  assertRun(fresh(({ a }) => succo(0, a)), [{ a: 1 }]);
  assertRun(fresh(({ b }) => succo(0n, b)), [{ b: 1n }]);
});
test("succo(-, +)", () => {
  assertRun(fresh(({ c }) => succo(c, 2)), [{ c: 1 }]);
  assertRun(fresh(({ d }) => succo(d, 2n)), [{ d: 1n }]);
});

test("pluso(+, +, -)", () => {
  assertRun(fresh(({ a }) => pluso(1, 2, a)), [{ a: 3n }]);
  assertRun(fresh(({ b }) => pluso(1n, 2, b)), [{ b: 3n }]);
  assertRun(fresh(({ c }) => pluso(1, 2n, c)), [{ c: 3n }]);
  assertRun(fresh(({ d }) => pluso(1n, 2n, d)), [{ d: 3n }]);
});
test("pluso(+, -, +)", () => {
  assertRun(fresh(({ e }) => pluso(1, e, 3)), [{ e: 2n }]);
  assertRun(fresh(({ f }) => pluso(1n, f, 3)), [{ f: 2n }]);
  assertRun(fresh(({ g }) => pluso(1, g, 3n)), [{ g: 2n }]);
  assertRun(fresh(({ h }) => pluso(1n, h, 3n)), [{ h: 2n }]);
});
test("pluso(-, +, +)", () => {
  assertRun(fresh(({ i }) => pluso(i, 2, 3)), [{ i: 1n }]);
  assertRun(fresh(({ j }) => pluso(j, 2n, 3)), [{ j: 1n }]);
  assertRun(fresh(({ k }) => pluso(k, 2, 3n)), [{ k: 1n }]);
  assertRun(fresh(({ l }) => pluso(l, 2n, 3n)), [{ l: 1n }]);
});

test("numbero(+)", () => {
  assertSucceeds(numbero(1));
  assertSucceeds(numbero(1n));
  assertSucceeds(numbero(1.5));
  assertFails(numbero(undefined));
  assertFails(numbero("1"));
  assertFails(numbero({}));
});

test("firsto(+, +)", () => {
  assertSucceeds(firsto(1, [1, 2, 3]));
  assertFails(firsto(1, []));
  assertFails(firsto(1, [2]));
});
test("firsto(-, +)", () => {
  assertRun(fresh(({ a }) => firsto(a, [3, 4, 5])), [{ a: 3 }]);
});
test("firsto(+, -)", () => {
  assertRun(fresh(({ b }) => firsto(4, [b, 5, 6])), [{ b: 4 }]);
  const gen = fresh(({ c }) => firsto(5, c))({});
  for (let i = 0; i < 10; ++i) {
    const list = gen.next().value?.c as unknown[];
    assertEquals(list[0], 5);
    for (let j = 1; j < i; ++j) {
      assertIsVar(list[j]);
    }
  }
});

test("lasto(+, +)", () => {
  assertSucceeds(lasto(3, [1, 2, 3]));
  assertFails(lasto(3, []));
  assertFails(lasto(3, [3, 2]));
});
test("lasto(-, +)", () => {
  assertRun(fresh(({ a }) => lasto(a, [5, 4, 3])), [{ a: 3 }]);
});
test("lasto(+, -)", () => {
  assertRun(fresh(({ b }) => lasto(4, [6, 5, b])), [{ b: 4 }]);
  const gen = fresh(({ c }) => lasto(5, c))({});
  for (let i = 0; i < 10; ++i) {
    const list = gen.next().value?.c as unknown[];
    for (let j = 0; j < i - 1; ++j) {
      assertIsVar(list[j]);
    }
    assertEquals(list.at(-1), 5);
  }
});

test("ntho(+, +, +)", () => {
  assertSucceeds(ntho(0, ["a"], "a"));
  assertFails(ntho(0, ["a"], "b"));
});
test("ntho(+, +, -)", () => {
  assertFails(ntho(0, [], new Var()));
  assertFails(ntho(1, ["a"], new Var()));
  assertRun(fresh(({ a }) => ntho(0, ["a"], a)), [{ a: "a" }]);
});
test("ntho(-, +, +)", () => {
  assertRun(
    fresh(({ n }) => ntho(n as Var, ["a", "b", "c", "b"], "b")),
    [{ n: 1 }, { n: 3 }],
  );
  assertFails(ntho(new Var(), ["a", "b", "c", "b"], "e"));
});
test("ntho(+, -, +)", () => {
  const gen = fresh(({ list }) => ntho(1, list, "f"))({});
  for (let len = 2; len < 12; ++len) {
    const { done, value } = gen.next();
    assertFalse(done, "Should have another state");
    const { list } = value;
    assert(Array.isArray(list), "Should be an array");
    assertEquals(list.length, len, "Should have the right length");
    assertIsVar(list[0], "First element should be a variable");
    assertEquals(list[1], "f", "Second element should be 'f'");
    for (let i = 2; i < len; ++i) {
      assertIsVar(list[i], `${i + 1}th element should be a variable.`);
    }
  }
});
test("ntho(-, -, ?)", () => {
  const gen = fresh(({ n, list }) => ntho(n, list, "g"))({});
  for (let len = 1; len < 12; ++len) {
    const { done, value } = gen.next();
    assertFalse(done, "Should have another state");
    const { list } = value;
    assert(Array.isArray(list), "Should be an array");
    assertEquals(list.length, len, "Should have the right length");
    for (let i = 0; i < len - 1; ++i) {
      assertIsVar(list[i], `${i + 1}th element should be a variable.`);
    }
    assertEquals(list[len - 1], "g", "Second element should be 'g'");
  }
});

test("stringChars(+, +)", () => {
  assertSucceeds(stringChars("hello", ["h", "e", "l", "l", "o"]));
});
test("stringChars(+, -)", () => {
  assertRun(
    fresh(({ chars }) => stringChars("world", chars)),
    [{ chars: ["w", "o", "r", "l", "d"] }],
  );
});
test("stringChars(-, +)", () => {
  assertRun(
    fresh(({ str }) => stringChars(str, ["f", "r", "i", "d", "g", "e"])),
    [{ str: "fridge" }],
  );
});

test("numberChars(+, +)", () => {
  assertSucceeds(numberChars(123, ["1", "2", "3"]));
});

test("numberChars(-, +)", () => {
  assertRun(fresh(({ n }) => numberChars(n, ["1", "2", "3"])), [{ n: 123 }]);
});

test("numberChars(+, -)", () => {
  assertRun(
    fresh(({ chars }) => numberChars(123, chars)),
    [{ chars: ["1", "2", "3"] }],
  );
});

// test("numberChars(-, -) throws", () => {
//   assertThrows(() => fresh(({ x, y }) => numberChars(x, y))({}));
// });

test("conso(+, +, +)", () => {
  assertSucceeds(conso(1, [2, 3], [1, 2, 3]));
});

test("conso(-, +, +)", () => {
  assertRun(fresh(({ a }) => conso(a, [2, 3], [1, 2, 3])), [{ a: 1 }]);
});

test("conso(+, -, +)", () => {
  assertRun(fresh(({ d }) => conso(4, d, [4, 5, 6])), [{ d: [5, 6] }]);
});

test("conso(+, +, -)", () => {
  assertRun(fresh(({ list }) => conso(4, [5, 6], list)), [{ list: [4, 5, 6] }]);
});
