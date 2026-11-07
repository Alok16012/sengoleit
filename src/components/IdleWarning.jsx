// The last minute before an automatic logout: a countdown and a way to stay.
export default function IdleWarning({ secondsLeft, onStay }) {
  if (secondsLeft == null) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-3">
        <p className="text-lg font-bold text-gray-900">Still there?</p>
        <p className="text-sm text-gray-600">
          You will be signed out in <span className="font-bold text-[#933d18]">{secondsLeft}</span> second{secondsLeft === 1 ? '' : 's'} because nothing has been done for a while.
        </p>
        <button onClick={onStay}
          className="w-full py-2.5 rounded-xl bg-[#933d18] text-white text-sm font-bold hover:bg-[#7d3314]">
          Stay signed in
        </button>
      </div>
    </div>
  )
}
