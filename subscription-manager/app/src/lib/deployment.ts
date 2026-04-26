import fs from "fs/promises";
import path from "path";

export interface DeploymentPlan {
  planId: number;
  price: string;
  interval: number;
  tokenAddress: string;
}

export interface DeploymentRecord {
  network: string;
  chainId: number;
  deployer: string;
  subscriptionManager: string;
  tokenA: string;
  tokenB: string;
  plans: DeploymentPlan[];
  deployedAt: string;
}

const deploymentPath = path.join(process.cwd(), "..", "contracts", "deployment.json");

export async function loadDeploymentRecord(): Promise<DeploymentRecord | null> {
  try {
    const raw = await fs.readFile(deploymentPath, "utf8");
    return JSON.parse(raw) as DeploymentRecord;
  } catch {
    return null;
  }
}
