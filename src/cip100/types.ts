import type { OnChain } from "../cip169/types.js";
import type {
	Author,
	ExternalUpdate,
	HashAlgorithm,
	JsonLdEnvelope,
	Reference,
} from "../core/types.js";

export interface Cip100Body {
	references?: Reference[];
	comment?: string;
	externalUpdates?: ExternalUpdate[];
	onChain?: OnChain;
}

export interface Cip100Document extends JsonLdEnvelope {
	hashAlgorithm: HashAlgorithm;
	authors?: Author[];
	body: Cip100Body;
}
