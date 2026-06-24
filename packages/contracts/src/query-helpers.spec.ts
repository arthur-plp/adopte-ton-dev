import { z } from "zod";
import { stringArrayQueryParam } from "./query-helpers";

const schema = z.object({ technologies: stringArrayQueryParam });

describe("stringArrayQueryParam", () => {
  it("laisse undefined tel quel quand le paramètre est absent", () => {
    const result = schema.parse({});
    expect(result.technologies).toBeUndefined();
  });

  it("normalise une chaîne unique en tableau à un élément", () => {
    const result = schema.parse({ technologies: "TypeScript" });
    expect(result.technologies).toEqual(["TypeScript"]);
  });

  it("conserve un tableau existant tel quel", () => {
    const result = schema.parse({ technologies: ["TypeScript", "React"] });
    expect(result.technologies).toEqual(["TypeScript", "React"]);
  });
});
