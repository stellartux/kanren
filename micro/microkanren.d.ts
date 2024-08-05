/** A var is an unbound logic variable */
export type Var = { id: string };

/** A state is a set of bindings from identifiers to values or variables. */
export type State = Record<string, unknown>;

/** A stream is a (possibly empty) sequence of states. */
export type Stream = Generator<State, void>;

/** A goal takes a state and returns a stream of unifying states. */
export type Goal = (state?: State) => Stream;

/** Goal constructors are the interface to µKanren. */
export type GoalConstructor = (state?: State) => Goal;

/** A code golfed µKanren implementation. */
declare namespace MicroKanren {
  /** Succeeds when `u` and `v` unify in the state. */
  function identical(u: unknown, v: unknown): Goal;

  /** Succeeds when all of the given `goals` succeed. */
  function conj(...goals: Goal[]): Goal;

  /** Succeeds when each of the given `goals` succeed. */
  function disj(...goals: Goal[]): Goal;

  /** Binds an id to a var, and calls the goal constructor with the new state. */
  function callFresh(id: string, gc: GoalConstructor): Goal;

  /** Lazily constructs a goal. */
  function delay(gc: GoalConstructor, s?: State): Goal;

  /** Always fails. */
  const fail: Goal;

  /** Succeeds once. */
  const succeed: Goal;
}
