import * as v from "valibot";

const LinksSchema = v.object({
  title: v.string(),
  url: v.optional(v.string()),
  clipboard: v.optional(v.string()),
});

const ProjectsSchema = v.object({
  title: v.string(),
  description: v.string(),
  link: v.optional(v.string()),
});

export type LinksType = v.InferInput<typeof LinksSchema>;
export type ProjectsType = v.InferInput<typeof ProjectsSchema>;
