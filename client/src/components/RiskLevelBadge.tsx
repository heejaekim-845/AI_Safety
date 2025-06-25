import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskLevelBadgeProps {
  level: string;
  className?: string;
}

export default function RiskLevelBadge({ level, className }: RiskLevelBadgeProps) {
  const getRiskConfig = (riskLevel: string) => {
    switch (riskLevel) {
      case "RED":
        return {
          label: "고위험",
          className: "bg-danger text-white border-danger",
          icon: "🔴"
        };
      case "YELLOW":
        return {
          label: "주의",
          className: "bg-warning text-white border-warning",
          icon: "🟡"
        };
      case "GREEN":
        return {
          label: "안전",
          className: "bg-success text-white border-success",
          icon: "🟢"
        };
      default:
        return {
          label: "미확인",
          className: "bg-gray-500 text-white border-gray-500",
          icon: "⚪"
        };
    }
  };

  const config = getRiskConfig(level);

  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, className)}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
