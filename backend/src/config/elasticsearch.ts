import { Client } from "@elastic/elasticsearch";

const elasticsearchClient = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
});

export default elasticsearchClient;