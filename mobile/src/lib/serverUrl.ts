const SERVER = "https://dealzora-sync.duckdns.org";

export async function getServerUrl(): Promise<string | null> {
  return SERVER;
}
