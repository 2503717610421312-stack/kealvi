export function getVoterId(): string {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return "";
  }

  const userJson = localStorage.getItem("liveqa_user");
  if (userJson) {
    try {
      const user = JSON.parse(userJson) as { id?: string };
      if (user?.id) return user.id;
    } catch {
      // ignore malformed data
    }
  }

  let id = localStorage.getItem("voter_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("voter_id", id);
  }
  return id;
}
