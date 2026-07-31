export type OwnerAssignment = Readonly<{
  assignmentId: string; vertical: string; scope: string; theatre: string;
  role: "Owner" | "Approver" | "Recipient" | "Finance owner";
  ownerName: string; responsibility: string;
}>;

export const OWNER_ASSIGNMENTS: readonly OwnerAssignment[] = Object.freeze([
  { assignmentId: "OWNER-OCCUPANCY", vertical: "Occupancy", scope: "All", theatre: "All", role: "Owner", ownerName: "Prashant Waghire", responsibility: "Drive occupancy growth, improve occupancy %, and achieve Occupancy targets." },
  { assignmentId: "OWNER-ESS-SUPPLY", vertical: "Essential Supply", scope: "All", theatre: "All", role: "Owner", ownerName: "Manikya Dahed", responsibility: "Increase supply, ensure product availability, and achieve Essentials Supply targets." },
  { assignmentId: "OWNER-ESS-DEMAND", vertical: "Essential Demand", scope: "All", theatre: "All", role: "Owner", ownerName: "Satish Sanghey", responsibility: "Drive customer demand, improve conversions, and achieve Essentials Demand targets." },
  { assignmentId: "OWNER-FONO-DEMAND", vertical: "FONO Demand", scope: "All", theatre: "All", role: "Owner", ownerName: "Srinivasan RG", responsibility: "Generate FONO demand, improve funnel performance, and achieve FONO Demand targets." },
  { assignmentId: "OWNER-FONO-SUPPLY", vertical: "FONO Supply", scope: "All", theatre: "All", role: "Owner", ownerName: "Srinivasan RG", responsibility: "Increase FONO supply capacity and achieve FONO Supply targets." },
  { assignmentId: "OWNER-SP-DEMAND-NORTH", vertical: "SP Demand", scope: "SP Demand Bot", theatre: "Rajputana|Deccan", role: "Owner", ownerName: "Prashant Waghire", responsibility: "Drive Shram Park demand growth and targets for the assigned theatres." },
  { assignmentId: "OWNER-SP-DEMAND-SOUTH", vertical: "SP Demand", scope: "SP Demand Bot", theatre: "Coromandel|Wellington", role: "Owner", ownerName: "Satish Sanghey", responsibility: "Drive Shram Park demand growth and targets for the assigned theatres." },
  { assignmentId: "OWNER-SP-SUPPLY-NORTH", vertical: "SP Supply", scope: "All", theatre: "Rajputana|Deccan", role: "Owner", ownerName: "Prashant Waghire", responsibility: "Increase Shram Park supply and achieve targets for the assigned theatres." },
  { assignmentId: "OWNER-SP-SUPPLY-SOUTH", vertical: "SP Supply", scope: "All", theatre: "Coromandel|Wellington", role: "Owner", ownerName: "Satish Sanghey", responsibility: "Increase Shram Park supply and achieve targets for the assigned theatres." },
  { assignmentId: "OWNER-ENTERPRISE-DEMAND", vertical: "Enterprise Demand", scope: "All", theatre: "All", role: "Owner", ownerName: "Srinivasan RG", responsibility: "Drive enterprise demand generation and achieve Enterprise Demand targets." },
  { assignmentId: "OWNER-ENTERPRISE-SUPPLY", vertical: "Enterprise Supply", scope: "All", theatre: "All", role: "Owner", ownerName: "Srinivasan RG", responsibility: "Expand enterprise supply capacity and achieve Enterprise Supply targets." },
  { assignmentId: "OWNER-FINANCE", vertical: "Finance", scope: "All", theatre: "All", role: "Owner", ownerName: "Shrey", responsibility: "Own financial governance, budgets, approvals, targets, and controls." },
  { assignmentId: "APPROVER-FINANCE", vertical: "Finance", scope: "All", theatre: "All", role: "Approver", ownerName: "Yoshit", responsibility: "Approve and receive governed Finance decisions." },
  { assignmentId: "RECIPIENT-FINANCE", vertical: "Finance", scope: "All", theatre: "All", role: "Recipient", ownerName: "Yoshit", responsibility: "Receive governed Finance decisions and outputs." },
  { assignmentId: "OWNER-COLLECTION-LOCAL", vertical: "Collection", scope: "Theatre operations", theatre: "All", role: "Owner", ownerName: "Local Theatre Teams", responsibility: "Maximise collections and reduce outstanding dues within each theatre." },
  { assignmentId: "OWNER-COLLECTION-FINANCE", vertical: "Collection", scope: "Finance", theatre: "All", role: "Finance owner", ownerName: "Bidhyadhar Nayak", responsibility: "Own Collection finance controls and achievement of collection targets." },
]);

const normal = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const aliases: Record<string, string> = { decaan: "deccan", coromandal: "coromandel", commandal: "coromandel", welington: "wellington" };
const theatre = (value: unknown) => aliases[normal(value)] || normal(value);

export function ownerFor(vertical: unknown, options: { theatre?: unknown; scope?: unknown; role?: OwnerAssignment["role"] } = {}) {
  const wantedScope = normal(options.scope || "all");
  const wantedTheatre = theatre(options.theatre);
  return OWNER_ASSIGNMENTS.find((item) => normal(item.vertical) === normal(vertical)
    && item.role === (options.role || "Owner")
    && (normal(item.scope) === "all" || normal(item.scope) === wantedScope)
    && (item.theatre.split("|").map(theatre).includes("all") || item.theatre.split("|").map(theatre).includes(wantedTheatre)))?.ownerName || "";
}
