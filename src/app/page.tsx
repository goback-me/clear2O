import { Suspense } from "react";
import ClearQuiz from "@/components/ClearQuiz";

export default function Home() {
  return (
    <Suspense>
      <ClearQuiz />
    </Suspense>
  );
}
