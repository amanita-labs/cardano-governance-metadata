import type { HashedReference } from "../core/types.js";
import type { Cip100Body, Cip100Document } from "../cip100/types.js";

export interface Cip108Body extends Cip100Body {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  references?: HashedReference[];
}

export interface Cip108Document extends Omit<Cip100Document, "body"> {
  body: Cip108Body;
}
