import { KysoIndex } from '@kyso-io/kyso-model';

export interface SearchData {
  took: number;
  timed_out: boolean;
  _shards: Shards;
  hits: Hits;
}

export interface Shards {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
}

export interface Hits {
  total: Total;
  max_score: number;
  hits: Hit[];
}

export interface Hit {
  _index: string;
  _type: TypeEnum;
  _id: string;
  _score: number;
  _source: KysoIndex;
}

export enum TypeEnum {
  Doc = '_doc',
}

export interface Total {
  value: number;
  relation: string;
}
