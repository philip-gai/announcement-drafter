export const authSuccessTemplate = `
doctype html
html(lang="en")
  head
    title announcement-drafter | authorization
    script(nonce=nonce).
      setTimeout(function () {
        window.location = '#{redirectUrl}'
      }, #{stringify(secondsToRedirect)} * 1000)
  body
    div
      h2 Success! Now Announcement Drafter can create discussions for you 🚀
    div
      p Sending you back to the #{redirectLocationText} in just a few seconds...
`;
