import UploadForm from "@/components/UploadForm";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Site Details
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Please fill in your contact details and upload a photo of the site.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-950">
          <UploadForm />
        </div>
      </div>
    </main>
  );
}
