interface Repository {
  url: string;
  name: string;
  description: string;
}

type RepositoryType = Repository[];

export type { RepositoryType };
