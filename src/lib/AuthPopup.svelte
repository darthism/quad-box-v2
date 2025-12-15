<script>
  import { auth } from '../stores/authStore'
  import { User } from '@lucide/svelte'

  let show = false
  let tab = 'login'

  let username = ''
  let password = ''
  let password2 = ''
  let avatarDataUrl = ''
  let avatarPreviewUrl = ''
  let message = null
  let busy = false

  const openModal = () => {
    show = true
    message = null
  }

  const closeModal = () => {
    show = false
    message = null
    busy = false
    password = ''
    password2 = ''
    avatarDataUrl = ''
    avatarPreviewUrl = ''
  }

  const handleKeydown = (event) => {
    if (event.key === 'Escape') closeModal()
  }

  const handleBackdropClick = (event) => {
    if (event.target.classList.contains('modal')) closeModal()
  }

  const fileToAvatarDataUrl = async (file) => {
    if (!file) return ''
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      throw new Error('Avatar must be a PNG, JPEG, or WebP image.')
    }
    // Client-side resize/compress to keep payload small.
    const bmp = await createImageBitmap(file)
    const max = 128
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bmp, 0, 0, w, h)
    // Always output JPEG for size (server accepts jpeg/png/webp; we send jpeg).
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  const onAvatarChange = async (event) => {
    message = null
    try {
      const file = event?.currentTarget?.files?.[0]
      const dataUrl = await fileToAvatarDataUrl(file)
      avatarDataUrl = dataUrl
      avatarPreviewUrl = dataUrl
    } catch (e) {
      avatarDataUrl = ''
      avatarPreviewUrl = ''
      message = { kind: 'error', text: e?.message ?? 'Invalid avatar.' }
    }
  }

  const doLogin = async () => {
    message = null
    busy = true
    try {
      await auth.login(username, password)
      message = { kind: 'success', text: 'Logged in.' }
      password = ''
    } catch (e) {
      message = { kind: 'error', text: e?.message ?? 'Login failed.' }
    } finally {
      busy = false
    }
  }

  const doSignup = async () => {
    message = null
    busy = true
    try {
      if (password !== password2) {
        throw new Error('Passwords do not match.')
      }
      if (!avatarDataUrl) {
        throw new Error('Avatar is required.')
      }
      await auth.signup(username, password, avatarDataUrl)
      message = { kind: 'success', text: 'Account created. You are now logged in.' }
      password = ''
      password2 = ''
    } catch (e) {
      message = { kind: 'error', text: e?.message ?? 'Sign up failed.' }
    } finally {
      busy = false
    }
  }
</script>

<button class="flex items-center justify-center" on:click={openModal} title={$auth.user ? `Logged in as ${$auth.user.username}` : 'Sign up / Log in'}>
  <User class="btn btn-square btn-ghost h-8 lg:h-6" />
</button>

{#if show}
  <div class="modal modal-open whitespace-normal" on:click={handleBackdropClick} on:keydown={handleKeydown} tabindex="0">
    <div class="modal-box w-[90%] max-w-lg">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">Account</h2>
        {#if $auth.user}
          <div class="badge badge-outline">{ $auth.user.username }</div>
        {/if}
      </div>

      {#if !$auth.user}
        <div role="tablist" class="tabs tabs-lift mt-4">
          <a role="tab" class="tab" class:tab-active={tab === 'login'} on:click={() => tab = 'login'}>Log in</a>
          <a role="tab" class="tab" class:tab-active={tab === 'signup'} on:click={() => tab = 'signup'}>Sign up</a>
        </div>

        <div class="mt-4 space-y-3">
          <label class="form-control w-full">
            <div class="label"><span class="label-text">Username</span></div>
            <input class="input input-bordered w-full" placeholder="3–20 chars: letters, numbers, _" bind:value={username} autocomplete="username" />
          </label>

          <label class="form-control w-full">
            <div class="label"><span class="label-text">Password</span></div>
            <input class="input input-bordered w-full" type="password" bind:value={password} autocomplete={tab === 'signup' ? 'new-password' : 'current-password'} />
          </label>

          {#if tab === 'signup'}
            <label class="form-control w-full">
              <div class="label"><span class="label-text">Confirm password</span></div>
              <input class="input input-bordered w-full" type="password" bind:value={password2} autocomplete="new-password" />
            </label>

            <label class="form-control w-full">
              <div class="label"><span class="label-text">Avatar (required)</span></div>
              <input class="file-input file-input-bordered w-full" type="file" accept="image/png,image/jpeg,image/webp" on:change={onAvatarChange} />
              {#if avatarPreviewUrl}
                <div class="mt-2 flex items-center gap-3">
                  <img alt="Avatar preview" class="w-12 h-12 rounded-full ring-1 ring-base-content/10" src={avatarPreviewUrl} />
                  <div class="text-xs opacity-70">Will be shown publicly on the leaderboard.</div>
                </div>
              {/if}
            </label>
          {/if}

          {#if message}
            <div class={"alert " + (message.kind === 'error' ? 'alert-error' : 'alert-success')}>
              <span>{message.text}</span>
            </div>
          {/if}

          <div class="flex gap-2">
            {#if tab === 'login'}
              <button class="btn btn-primary flex-1" disabled={busy} on:click={doLogin}>
                Log in
                {#if busy}<span class="loading loading-spinner"></span>{/if}
              </button>
            {:else}
              <button class="btn btn-primary flex-1" disabled={busy} on:click={doSignup}>
                Sign up
                {#if busy}<span class="loading loading-spinner"></span>{/if}
              </button>
            {/if}
            <button class="btn flex-1" on:click={closeModal} disabled={busy}>Close</button>
          </div>

          <div class="text-xs opacity-70">
            Online account (stored on the server). Your login is saved on this device via a token.
          </div>
        </div>
      {:else}
        <div class="mt-4 space-y-3">
          <p class="text-sm opacity-80">You are logged in as <strong>{$auth.user.username}</strong>.</p>
          <div class="flex gap-2">
            <button class="btn btn-error flex-1" on:click={() => auth.logout()}>Log out</button>
            <button class="btn flex-1" on:click={closeModal}>Close</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}


