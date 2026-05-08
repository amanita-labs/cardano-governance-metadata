import type { ExternalUpdate } from "../core/types.js";
import type { Cip100Document } from "../cip100/types.js";
import type { OnChain } from "../cip169/types.js";

export type Cip119ReferenceType =
  | "Link"
  | "Identity"
  | "GovernanceMetadata"
  | "Other";

export interface Cip119Reference {
  "@type": Cip119ReferenceType;
  label: string;
  uri: string;
}

export interface ImageObject {
  "@type"?: "ImageObject";
  contentUrl: string;
  sha256?: string;
}

export interface Cip119Body {
  givenName: string;
  image?: ImageObject;
  objectives?: string;
  motivations?: string;
  qualifications?: string;
  paymentAddress?: string;
  doNotList?: boolean;
  references?: Cip119Reference[];
  comment?: string;
  externalUpdates?: ExternalUpdate[];
  onChain?: OnChain;
}

export interface Cip119Document extends Omit<Cip100Document, "body" | "authors"> {
  authors?: [];
  body: Cip119Body;
}
