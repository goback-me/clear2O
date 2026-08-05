import { Suspense } from "react";
import PhotoUploadForm from "@/components/PhotoUploadForm";

export default function PhotoUploadPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-[#F3FAF9] px-4 py-12">
      <div className="w-full max-w-lg">
        <Suspense>
          <PhotoUploadForm />
        </Suspense>
      </div>
    </main>
  );
}
