import { defineCollection, z } from "astro:content";
import type { Loader } from "astro/loaders";
import type { ZodTypeAny, ZodObject } from "zod";

const strapiPostsLoader = defineCollection({
  loader: strapiLoader({ contentType: "post" }),
});

export const collections = {
  strapiPostsLoader,
};

// TODO: Update this for all strapi content types

function strapiLoader({ contentType }: { contentType: string }): Loader {

  function mapTypeToZodSchema(type: string, field: any): ZodTypeAny {
    switch (type) {
      case "string":
        return z.string();
      case "uid":
        return z.string(); // Assuming 'uid' is treated as a string
      case "media":
        return z.object({
          allowedTypes: z.array(z.enum(field.allowedTypes)),
          type: z.literal("media"),
          multiple: z.boolean(),
        });
      case "richtext":
        return z.string(); // Assuming 'richtext' is treated as a string
      case "datetime":
        return z.string().datetime();
      case "relation":
        return z
          .object({
            relation: z.literal(field.relation),
            target: z.literal(field.target),
            configurable: z.boolean().optional(),
            writable: z.boolean().optional(),
            visible: z.boolean().optional(),
            useJoinTable: z.boolean().optional(),
            private: z.boolean().optional(),
          })
          .optional();
      case "boolean":
        return z.boolean();
      case "number":
        return z.number();
      case "array":
        return z.array(mapTypeToZodSchema(field.items.type, field.items)); // Recursively map array items
      case "object":
        const shape: Record<string, ZodTypeAny> = {};
        
        for (const [key, value] of Object.entries(field.properties)) {
          shape[key] = mapTypeToZodSchema(value.type, value);
        }
        return z.object(shape);
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  function generateZodSchema(attributes: Record<string, any>): ZodObject<any> {
    const shape: Record<string, ZodTypeAny> = {};
    for (const [key, value] of Object.entries(attributes)) {
      const { type, ...rest } = value;
      shape[key] = mapTypeToZodSchema(type, rest);
    }
    return z.object(shape);
  }

  return {
    name: "strapi-posts",
    load: async ({ store, meta, logger }) => {
      const lastSynced = meta.get("lastSynced");

      // Don't sync more than once a minute
      // TODO: learn more about the lastSynced and meta methods
      if (lastSynced && Date.now() - Number(lastSynced) < 1000 * 60) {
        logger.info("Skipping Strapi sync");
        return;
      }

      logger.info("Fetching posts from Strapi");
      // Fetching the posts from Strapi
      const response = await fetch(`http://localhost:1337/api/${contentType}s`);
      const data = await response.json();

      const posts = data.data;

      store.clear();

      // TODO: Learn more about the store.set method

      for (const post of posts.slice(0, 100)) {
        store.set({ id: post.documentId, data: post });
      }
      meta.set("lastSynced", String(Date.now()));
    },

    schema: async () => {
      // This response is coming from the Strapi plugin that exposes the Strapi schema
      // will be required for this loader to work
      // Fetching the schema from Strapi
      const response = await fetch(
        `http://localhost:1337/get-strapi-schema/schema/${contentType}`
      );
      const data = await response.json();
      const attributes = data.attributes;

      console.log("##################################");
      console.log("From the schema", attributes);
      console.log("##################################");

      const zodSchema = generateZodSchema(attributes);

      console.log("zodSchema", zodSchema);

      return zodSchema;
    },
    
  };
}
