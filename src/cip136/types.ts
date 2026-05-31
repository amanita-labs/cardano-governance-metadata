import type { Cip100Document } from "../cip100/types.js";
import type { OnChain } from "../cip169/types.js";
import type { ExternalUpdate, ReferenceType } from "../core/types.js";

export type Cip136ReferenceType = ReferenceType | "RelevantArticles";

export interface Cip136ReferenceHash {
	hashDigest: string;
	hashAlgorithm: "blake2b-256";
}

export interface Cip136Reference {
	"@type": Cip136ReferenceType;
	label: string;
	uri: string;
	referenceHash?: Cip136ReferenceHash;
}

export interface InternalVote {
	constitutional?: number;
	unconstitutional?: number;
	abstain?: number;
	didNotVote?: number;
	againstVote?: number;
}

export interface Cip136Body {
	summary: string;
	rationaleStatement: string;
	precedentDiscussion?: string;
	counterargumentDiscussion?: string;
	conclusion?: string;
	internalVote?: InternalVote;
	references?: Cip136Reference[];
	comment?: string;
	externalUpdates?: ExternalUpdate[];
	onChain?: OnChain;
}

export interface Cip136Document extends Omit<Cip100Document, "body"> {
	body: Cip136Body;
}
