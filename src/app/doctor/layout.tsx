import Sidebar from '@/components/Sidebar';

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <main className="flex-grow p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
