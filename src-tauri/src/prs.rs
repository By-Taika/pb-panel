use serde::{Deserialize, Serialize};

use crate::tokens::token_for;

const API_BASE: &str = "https://api.github.com";

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("pb-panel")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

#[derive(Deserialize)]
struct GhPrDetail {
    number: u32,
    title: String,
    body: Option<String>,
    draft: bool,
    html_url: String,
    mergeable: Option<bool>,
    mergeable_state: Option<String>,
    auto_merge: Option<serde_json::Value>,
    head: GhRef,
    base: GhRef,
    user: GhUser,
    updated_at: String,
}

#[derive(Deserialize)]
struct GhRef {
    #[serde(rename = "ref")]
    refname: String,
}

#[derive(Deserialize)]
struct GhUser {
    login: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PrDetail {
    pub number: u32,
    pub title: String,
    pub body: Option<String>,
    pub draft: bool,
    pub url: String,
    pub mergeable: Option<bool>,
    pub mergeable_state: Option<String>,
    pub auto_merge_enabled: bool,
    pub head_ref: String,
    pub base_ref: String,
    pub author: String,
    pub updated: String,
}

impl From<GhPrDetail> for PrDetail {
    fn from(p: GhPrDetail) -> Self {
        Self {
            number: p.number,
            title: p.title,
            body: p.body,
            draft: p.draft,
            url: p.html_url,
            mergeable: p.mergeable,
            mergeable_state: p.mergeable_state,
            auto_merge_enabled: p.auto_merge.is_some(),
            head_ref: p.head.refname,
            base_ref: p.base.refname,
            author: p.user.login,
            updated: p.updated_at,
        }
    }
}

async fn gh_request<T: serde::de::DeserializeOwned>(
    method: reqwest::Method,
    path: &str,
    account_id: &str,
    env_var: Option<&str>,
    body: Option<serde_json::Value>,
) -> Result<T, String> {
    let token = token_for(account_id, env_var)
        .ok_or_else(|| format!("Token yok: {}", account_id))?;
    let mut req = client()
        .request(method, format!("{}{}", API_BASE, path))
        .bearer_auth(&token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("{} — {}", status, text));
    }
    res.json::<T>().await.map_err(|e| e.to_string())
}

async fn gh_put_bare(
    path: &str,
    account_id: &str,
    env_var: Option<&str>,
    body: serde_json::Value,
) -> Result<(), String> {
    let token = token_for(account_id, env_var)
        .ok_or_else(|| format!("Token yok: {}", account_id))?;
    let res = client()
        .put(format!("{}{}", API_BASE, path))
        .bearer_auth(&token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("{} — {}", status, text));
    }
    Ok(())
}

pub async fn get_pr_detail(
    owner: &str,
    repo: &str,
    number: u32,
    account_id: &str,
    env_var: Option<&str>,
) -> Result<PrDetail, String> {
    let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
    let raw: GhPrDetail = gh_request(reqwest::Method::GET, &path, account_id, env_var, None).await?;
    Ok(raw.into())
}

pub async fn create_pr(
    owner: &str,
    repo: &str,
    head: &str,
    base: &str,
    title: &str,
    body: Option<&str>,
    draft: bool,
    account_id: &str,
    env_var: Option<&str>,
) -> Result<PrDetail, String> {
    let path = format!("/repos/{}/{}/pulls", owner, repo);
    let payload = serde_json::json!({
        "title": title,
        "head": head,
        "base": base,
        "body": body.unwrap_or(""),
        "draft": draft,
    });
    let raw: GhPrDetail =
        gh_request(reqwest::Method::POST, &path, account_id, env_var, Some(payload)).await?;
    Ok(raw.into())
}

pub async fn merge_pr(
    owner: &str,
    repo: &str,
    number: u32,
    method: &str, // "merge" | "squash" | "rebase"
    account_id: &str,
    env_var: Option<&str>,
) -> Result<String, String> {
    let path = format!("/repos/{}/{}/pulls/{}/merge", owner, repo, number);
    let payload = serde_json::json!({ "merge_method": method });
    gh_put_bare(&path, account_id, env_var, payload).await?;
    Ok(format!("PR #{} merge edildi ({})", number, method))
}

pub async fn enable_auto_merge(
    owner: &str,
    repo: &str,
    number: u32,
    method: &str,
    account_id: &str,
    env_var: Option<&str>,
) -> Result<String, String> {
    // Auto-merge is a GraphQL mutation — REST endpoint `/auto_merge` doesn't exist as PUT.
    let token = token_for(account_id, env_var)
        .ok_or_else(|| format!("Token yok: {}", account_id))?;
    let pr = get_pr_detail(owner, repo, number, account_id, env_var).await?;
    // GraphQL enablePullRequestAutoMerge needs the node_id — get it via REST.
    let node_id: String = {
        let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
        let res = client()
            .get(format!("{}{}", API_BASE, path))
            .bearer_auth(&token)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let v: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        v.get("node_id")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "node_id bulunamadı".to_string())?
    };

    let merge_method_upper = method.to_uppercase();
    let query = format!(
        r#"mutation {{
            enablePullRequestAutoMerge(input: {{pullRequestId: "{}", mergeMethod: {}}}) {{
                pullRequest {{ number }}
            }}
        }}"#,
        node_id, merge_method_upper
    );

    let res = client()
        .post(format!("{}/graphql", API_BASE))
        .bearer_auth(&token)
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({ "query": query }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    let v: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() || v.get("errors").is_some() {
        return Err(format!("GraphQL hata: {}", v));
    }
    Ok(format!("PR #{} için auto-merge aktifleştirildi", pr.number))
}

pub async fn disable_auto_merge(
    owner: &str,
    repo: &str,
    number: u32,
    account_id: &str,
    env_var: Option<&str>,
) -> Result<String, String> {
    let token = token_for(account_id, env_var)
        .ok_or_else(|| format!("Token yok: {}", account_id))?;
    let pr_path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
    let res = client()
        .get(format!("{}{}", API_BASE, pr_path))
        .bearer_auth(&token)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let v: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let node_id = v
        .get("node_id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "node_id bulunamadı".to_string())?;
    let query = format!(
        r#"mutation {{
            disablePullRequestAutoMerge(input: {{pullRequestId: "{}"}}) {{
                pullRequest {{ number }}
            }}
        }}"#,
        node_id
    );
    let res2 = client()
        .post(format!("{}/graphql", API_BASE))
        .bearer_auth(&token)
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({ "query": query }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let v2: serde_json::Value = res2.json().await.map_err(|e| e.to_string())?;
    if v2.get("errors").is_some() {
        return Err(format!("GraphQL hata: {}", v2));
    }
    Ok(format!("PR #{} auto-merge iptal edildi", number))
}
