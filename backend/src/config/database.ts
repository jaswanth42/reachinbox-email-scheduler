import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "reachinbox",
  password: "reachinbox_password",
  database: "reachinbox",
});

export default pool;