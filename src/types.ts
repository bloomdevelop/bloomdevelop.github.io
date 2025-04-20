import * as v from "valibot";

interface ILinks {
  title: string;
  url?: string;
  clipboard?: string;
}

const RepoSchema = v.object({
  title: v.string(),
  description: v.string(),
  link: v.optional(v.string()),
});

export type LinksType = ILinks;
export type RepoType = v.InferInput<typeof RepoSchema>;
