const AUTHOR_NAME = "Spring";

interface RoadmapArray {
  description: string;
  done: boolean;
}

const roadmap_array: RoadmapArray[] = [
  {
    description: "Transfur System",
    done: false,
  },
  {
    description: "Main Menu",
    done: false,
  },
  {
    description: "Health Bar",
    done: true,
  },
  {
    description: "Player List",
    done: true,
  },
  {
    description: "Shop UI",
    done: false,
  },
  {
    description: "Proper Lighting System",
    done: true,
  },
  {
    description: "Anti-Cheat (Separate Closed-Source)",
    done: false,
  },
  {
    description: "Combat System and Combat Logging",
    done: false,
  },
  {
    description: "Main Menu UI",
    done: false,
  },
  {
    description: "Inventory System",
    done: false,
  },
];

export { AUTHOR_NAME, roadmap_array };
