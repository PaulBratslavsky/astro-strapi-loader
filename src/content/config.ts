import { defineCollection, z } from "astro:content";
import type { Loader } from "astro/loaders";
import type { ZodTypeAny, ZodObject } from "zod";

/*
  You can test this example by adding the following to your .env file:
  STRAPI_BASE_URL=https://deserving-harmony-9f5ca04daf.strapiapp.com

  You will be able to get Strapi Content Types from the Strapi API
  https://deserving-harmony-9f5ca04daf.strapiapp.com/get-strapi-schema/schema/post

  You will be able to get the posts from the Strapi API
  https://deserving-harmony-9f5ca04daf.strapiapp.com/api/posts
*/

const STRAPI_BASE_URL = import.meta.env.STRAPI_BASE_URL;

if (!import.meta.env.STRAPI_BASE_URL) {
  const errorMessage = "STRAPI_BASE_URL environment variable is not set";
  console.log(errorMessage);
  throw new Error(errorMessage);
}

// DEFINE COLLECTIONS
const strapiPostsLoader = defineCollection({
  loader: strapiLoader({ contentType: "post" }),
});

// EXPORT COLLECTIONS
export const collections = {
  strapiPostsLoader,
};

// CREATE LOADER
function strapiLoader({ contentType }: { contentType: string }): Loader {


  // This is a helper function that maps the Strapi field types to Zod types
  // It is used to generate the Zod schema from the Strapi schema
  // You can update this function to add more types or modify existing ones

  function mapTypeToZodSchema(type: string, field: any): ZodTypeAny {
    switch (type) {
      case "string":
        return z.string();
      case "uid":
        return z.string();
      case "media":
        return z.object({
          allowedTypes: z.array(z.enum(field.allowedTypes)),
          type: z.literal("media"),
          multiple: z.boolean(),
          url: z.string(),
          alternativeText: z.string().optional(),
          caption: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
        });
      case "richtext":
        return z.string();
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
        return z.array(mapTypeToZodSchema(field.items.type, field.items));
      case "object": {
        const shape: Record<string, ZodTypeAny> = {};

        for (const [key, value] of Object.entries(field.properties)) {
          if (typeof value === "object" && value !== null && "type" in value) {
            shape[key] = mapTypeToZodSchema(value.type as string, value);
          } else {
            console.log("Invalid field value for key: ", key);
            throw new Error(`Invalid field value for key: ${key}`);
          }
        }
        return z.object(shape);
      }
      case "text":
        return z.string();
      case "dynamiczone":
        return z.array(z.object({
          __component: z.string(),
        }));
      default:
        console.warn(`Unsupported type: ${type}. Falling back to any.`);
        return z.any();
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
      if (lastSynced && Date.now() - Number(lastSynced) < 1000 * 60) {
        logger.info("Skipping Strapi sync");
        return;
      }

      logger.info("Fetching posts from Strapi");

      // Fetching the posts from Strapi
      const path = `/api/${contentType}s`
      const url = new URL(path, STRAPI_BASE_URL);

      url.searchParams.set("populate", "*");


      const response = await fetch(url.href);
      const data = await response.json();
      const posts = data.data;

      store.clear();

      for (const post of posts) {
        store.set({ id: post.id, data: post });
      }
      
      meta.set("lastSynced", String(Date.now()));
    },

    schema: async () => {
      // This response is coming from the Strapi plugin that exposes the Strapi schema
      // will be required for this loader to work
      // Fetching the schema from Strapi

      const schemaPath = "/get-strapi-schema/schema/" + contentType;
      const schemaUrl = new URL(schemaPath, STRAPI_BASE_URL);

      const response = await fetch(schemaUrl.href);
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
