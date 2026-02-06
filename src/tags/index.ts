import {
  tagResolvers as tagResolversFor1_2,
  tagNodeResolvers as tagNodeResolversFor1_2,
} from "./tags1.2.ts";
import {
  tagResolvers as tagResolversFor1_1,
  tagNodeResolvers as tagNodeResolversFor1_1,
} from "./tags1.1.ts";

export const tagResolvers = {
  next: tagResolversFor1_2,
  "1.2": tagResolversFor1_2,
  "1.1": tagResolversFor1_1,
};
export const tagNodeResolvers = {
  next: tagNodeResolversFor1_2,
  "1.2": tagNodeResolversFor1_2,
  "1.1": tagNodeResolversFor1_1,
};
