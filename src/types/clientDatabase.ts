import type { Database } from "./database";

type Trace = Database["public"]["Tables"]["world_traces"];

/** Column grants and the BEFORE INSERT trigger narrow the generated write contract. */
export type ClientDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "world_traces"> & {
      world_traces: Omit<Trace, "Insert" | "Update"> & {
        Insert: Pick<
          Trace["Insert"],
          "world_key" | "place_id" | "author_id" | "body" | "client_request_id"
        >;
        Update: Pick<Trace["Update"], "deleted_at">;
      };
    };
  };
};
