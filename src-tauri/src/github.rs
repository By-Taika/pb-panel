use serde::{Deserialize, Serialize};

use crate::tokens::token_for;

const API_BASE: &str = "https://api.github.com";

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("pb-panel")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

async fn gh_get<T: serde::de::DeserializeOwned>(path: &str, account: &str) -> Option<T> {
    let token = token_for(account)?;
    let res = client()
        .get(format!("{}{}", API_BASE, path))
        .bearer_auth(&token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    res.json::<T>().await.ok()
}

#[derive(Deserialize)]
struct GhPullRequest {
    number: u32,
    title: String,
    draft: bool,
    user: GhUser,
    html_url: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct GhUser {
    login: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OpenPr {
    pub number: u32,
    pub title: String,
    pub draft: bool,
    pub author: String,
    pub url: String,
    pub updated: String,
}

pub async fn fetch_open_prs(owner: &str, repo: &str, account: &str) -> Vec<OpenPr> {
    let path = format!("/repos/{}/{}/pulls?state=open&per_page=10", owner, repo);
    let prs: Vec<GhPullRequest> = match gh_get(&path, account).await {
        Some(v) => v,
        None => return Vec::new(),
    };
    prs.into_iter()
        .map(|p| OpenPr {
            number: p.number,
            title: p.title,
            draft: p.draft,
            author: p.user.login,
            url: p.html_url,
            updated: p.updated_at,
        })
        .collect()
}

#[derive(Deserialize)]
struct GhRepoMetaRaw {
    private: bool,
    default_branch: String,
    stargazers_count: u32,
    open_issues_count: u32,
    description: Option<String>,
    pushed_at: String,
    language: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RepoMeta {
    pub private: bool,
    pub default_branch: String,
    pub stars: u32,
    pub open_issues: u32,
    pub description: Option<String>,
    pub pushed_at: String,
    pub language: Option<String>,
}

pub async fn fetch_repo_meta(owner: &str, repo: &str, account: &str) -> Option<RepoMeta> {
    let path = format!("/repos/{}/{}", owner, repo);
    let raw: GhRepoMetaRaw = gh_get(&path, account).await?;
    Some(RepoMeta {
        private: raw.private,
        default_branch: raw.default_branch,
        stars: raw.stargazers_count,
        open_issues: raw.open_issues_count,
        description: raw.description,
        pushed_at: raw.pushed_at,
        language: raw.language,
    })
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GhUserInfo {
    pub login: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(rename = "avatar_url")]
    pub avatar_url: String,
}

pub async fn fetch_user(account: &str) -> Option<GhUserInfo> {
    gh_get("/user", account).await
}
